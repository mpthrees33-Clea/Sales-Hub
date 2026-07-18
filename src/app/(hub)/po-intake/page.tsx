import { ScanText } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">PO Intake</h1>
      <Card>
        <EmptyState
          icon={ScanText}
          title="No purchase orders yet"
          copy="Drop a PO PDF and watch grounded extraction plus seven validation layers produce a draft sales order. Grounded or it escalates."
        />
      </Card>
    </div>
  );
}
