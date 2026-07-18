import { Package } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Samples</h1>
      <Card>
        <EmptyState
          icon={Package}
          title="No sample orders in motion"
          copy="Samples are the sale. Requests become approvable confirmations in one overnight cycle."
        />
      </Card>
    </div>
  );
}
