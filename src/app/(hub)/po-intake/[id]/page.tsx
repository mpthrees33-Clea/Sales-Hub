/** PO Intake detail (WO-06 task 16) — split view, checklist, resolution. */
import { notFound } from "next/navigation";
import { getPurchaseOrder } from "@/lib/queries/po-intake";
import { PoDetailView } from "../_components/po-detail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPurchaseOrder(id);
  if (!detail) notFound();
  return <PoDetailView detail={detail} />;
}
