/**
 * Seed-time consistency check (docs/04 §4): any SKU, person, project, price,
 * or quote number mentioned in any fixture must exist in the DB. Fails loudly
 * with a named list of misses.
 */
import { inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { contacts, emailThreads, meetings, products, projects, quotes } from "@/db/schema";
import { INBOUND_MONDAY, ALL_SENT } from "./fixtures/emails";
import { HARBORVIEW_TRANSCRIPT, TRANSCRIPT_REFS } from "./fixtures/transcript";
import { PO_CLEAN, PO_MISMATCH } from "./data/commerce";

export type FixtureRefs = {
  skus: string[];
  quotes: string[];
  projects: string[];
  meetings: string[];
  contactNames: string[];
  scannedTexts: string[];
};

export function collectFixtureRefs(): FixtureRefs {
  const refs: FixtureRefs = { skus: [], quotes: [], projects: [], meetings: [], contactNames: [], scannedTexts: [] };
  for (const f of [...INBOUND_MONDAY, ...ALL_SENT]) {
    refs.skus.push(...(f.refs.skus ?? []));
    refs.quotes.push(...(f.refs.quotes ?? []));
    refs.projects.push(...(f.refs.projects ?? []));
    if ("meetings" in f.refs) refs.meetings.push(...((f.refs as { meetings?: string[] }).meetings ?? []));
    refs.scannedTexts.push(f.body, f.subject);
  }
  refs.skus.push(...TRANSCRIPT_REFS.skus);
  refs.projects.push(...TRANSCRIPT_REFS.projects);
  refs.contactNames.push(...TRANSCRIPT_REFS.contacts);
  refs.scannedTexts.push(...HARBORVIEW_TRANSCRIPT.map((s) => s.text));
  for (const po of [PO_CLEAN, PO_MISMATCH]) {
    refs.skus.push(...po.lines.map((l) => l.sku));
    if (po.referencedQuote) refs.quotes.push(po.referencedQuote);
  }
  return refs;
}

export async function runConsistencyCheck(db: Db, extra?: Partial<FixtureRefs>): Promise<{ ok: boolean; misses: string[] }> {
  const refs = collectFixtureRefs();
  for (const k of ["skus", "quotes", "projects", "meetings", "contactNames", "scannedTexts"] as const) {
    if (extra?.[k]) refs[k].push(...extra[k]!);
  }

  // Free-text scan widens structured refs: every SKU-shaped and quote-shaped
  // token in any fixture body must resolve.
  for (const text of refs.scannedTexts) {
    refs.skus.push(...(text.match(/MS-[A-Z]{2}-\d{4}/g) ?? []));
    refs.quotes.push(...(text.match(/\bQ-\d{4}\b/g) ?? []));
  }

  const misses: string[] = [];
  const uniq = (a: string[]) => [...new Set(a)].filter(Boolean);

  const skus = uniq(refs.skus);
  if (skus.length) {
    const rows = await db.select({ sku: products.sku }).from(products).where(inArray(products.sku, skus));
    const found = new Set(rows.map((r) => r.sku));
    for (const s of skus) if (!found.has(s)) misses.push(`sku:${s}`);
  }

  const quoteNums = uniq(refs.quotes);
  if (quoteNums.length) {
    const rows = await db.select({ number: quotes.number }).from(quotes).where(inArray(quotes.number, quoteNums));
    const found = new Set(rows.map((r) => r.number));
    for (const q of quoteNums) if (!found.has(q)) misses.push(`quote:${q}`);
  }

  const projectNames = uniq(refs.projects);
  if (projectNames.length) {
    const rows = await db.select({ name: projects.name }).from(projects).where(inArray(projects.name, projectNames));
    const found = new Set(rows.map((r) => r.name));
    for (const p of projectNames) if (!found.has(p)) misses.push(`project:${p}`);
  }

  const meetingTitles = uniq(refs.meetings);
  if (meetingTitles.length) {
    const rows = await db.select({ title: meetings.title }).from(meetings).where(inArray(meetings.title, meetingTitles));
    const found = new Set(rows.map((r) => r.title));
    for (const m of meetingTitles) if (!found.has(m)) misses.push(`meeting:${m}`);
  }

  const names = uniq(refs.contactNames);
  if (names.length) {
    const rows = await db.select({ name: contacts.name }).from(contacts).where(inArray(contacts.name, names));
    const found = new Set(rows.map((r) => r.name));
    for (const n of names) if (!found.has(n)) misses.push(`contact:${n}`);
  }

  // Email fixtures must have landed as threads.
  const subjects = INBOUND_MONDAY.map((f) => f.subject);
  const threadRows = await db
    .select({ subject: emailThreads.subject })
    .from(emailThreads)
    .where(inArray(emailThreads.subject, subjects));
  const threadFound = new Set(threadRows.map((r) => r.subject));
  for (const s of subjects) if (!threadFound.has(s)) misses.push(`thread:${s}`);

  return { ok: misses.length === 0, misses };
}
