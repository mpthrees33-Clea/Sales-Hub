import { KpiTile } from "@/components/kpi-tile";
import { kpis } from "@/lib/queries/dashboard";

export async function KpiRow() {
  const k = await kpis();
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile label="Sales created · week" {...k.createdWk} />
      <KpiTile label="Sales created · month" {...k.createdMo} />
      <KpiTile label="Invoiced · week" {...k.invoicedWk} />
      <KpiTile label="Invoiced · month" {...k.invoicedMo} />
    </div>
  );
}
