"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { presentations } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { composeSlides, exportPresentationPdf } from "@/lib/presentations";

export async function createPresentation(input: { title: string; productIds: string[] }) {
  const session = await requireSession();
  if (input.productIds.length === 0) return { ok: false as const, error: "pick at least one product" };
  const slides = await composeSlides(input.title, input.productIds);
  const [row] = await db
    .insert(presentations)
    .values({ title: input.title, slides, status: "draft" })
    .returning({ id: presentations.id });
  await audit({
    actor: `user:${session.userId}`,
    action: "presentation.created",
    objectType: "presentation",
    objectId: row!.id,
    detail: { slides: slides.length },
  });
  revalidatePath("/catalog/presentations");
  return { ok: true as const, presentationId: row!.id };
}

export async function reorderSlides(presentationId: string, fromIndex: number, toIndex: number) {
  const session = await requireSession();
  const pres = await db.query.presentations.findFirst({ where: (t, { eq }) => eq(t.id, presentationId) });
  if (!pres) return { ok: false as const };
  const slides = [...pres.slides];
  const [moved] = slides.splice(fromIndex, 1);
  if (!moved) return { ok: false as const };
  slides.splice(toIndex, 0, moved);
  await db.update(presentations).set({ slides }).where((await import("drizzle-orm")).eq(presentations.id, presentationId));
  void session;
  revalidatePath(`/catalog/presentations`);
  return { ok: true as const };
}

export async function exportPresentation(presentationId: string) {
  const session = await requireSession();
  const result = await exportPresentationPdf(presentationId, `user:${session.userId}`);
  revalidatePath("/catalog/presentations");
  revalidatePath("/catalog/assets");
  return { ok: true as const, ...result };
}
