import { LayoutDashboard } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Mission Control</h1>
      <Card>
        <EmptyState
          icon={LayoutDashboard}
          title="No overnight run yet"
          copy="Agents run at 5:00 AM and their work lands here — KPIs, the overnight brief, today's docket, and live run traces."
        />
      </Card>
    </div>
  );
}
