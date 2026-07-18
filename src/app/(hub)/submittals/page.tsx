import { FolderCheck } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Submittals</h1>
      <Card>
        <EmptyState
          icon={FolderCheck}
          title="No submittal packages"
          copy="Eight hours of document assembly compressed to minutes — cover sheet, TOC, dividers, page stamps."
        />
      </Card>
    </div>
  );
}
