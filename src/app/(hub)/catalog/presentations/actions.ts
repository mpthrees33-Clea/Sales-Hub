"use server";

/** Presentation actions (WO-10 tasks 5–6). */
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createPresentation, exportPresentationPdf } from "@/lib/presentations";

export async function createPresentationAction(title: string, productIds: string[]): Promise<{ id: string }> {
  await requireSession();
  const r = await createPresentation(title || "Product Selection", productIds);
  revalidatePath("/catalog/presentations");
  return { id: r.id };
}

export async function exportPresentationAction(id: string): Promise<{ assetId: string; blobUrl: string; pages: number }> {
  await requireSession();
  const r = await exportPresentationPdf(id);
  revalidatePath(`/catalog/presentations/${id}/present`);
  revalidatePath("/catalog/assets");
  return r;
}
