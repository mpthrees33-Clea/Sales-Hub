import { BookOpen } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Catalog</h1>
      <Card>
        <EmptyState
          icon={BookOpen}
          title="Catalog loads from seed"
          copy="Sixty SKUs across wood, metal, stone, solid, and texture families — with PDS documents and live stock."
        />
      </Card>
    </div>
  );
}
