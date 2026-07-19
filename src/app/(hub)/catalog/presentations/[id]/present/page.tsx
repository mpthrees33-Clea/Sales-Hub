/** Present a deck (WO-10 tasks 5–6) — fullscreen slideshow + PDF export. */
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { presentations } from "@/db/schema";
import { Deck } from "./deck";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pres = await db.query.presentations.findFirst({ where: eq(presentations.id, id) });
  if (!pres) notFound();
  return <Deck id={pres.id} title={pres.title} slides={pres.slides} exported={Boolean(pres.exportedAssetId)} />;
}
