import { Map } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Routes</h1>
      <Card>
        <EmptyState
          icon={Map}
          title="No route computed"
          copy="Today's meetings become an optimized driving day with leave-by times and a one-tap Maps link."
        />
      </Card>
    </div>
  );
}
