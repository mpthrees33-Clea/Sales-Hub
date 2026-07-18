import { Inbox } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Approvals</h1>
      <Card>
        <EmptyState
          icon={Inbox}
          title="The queue is clear"
          copy="Every agent draft terminates here for human review. Drafts only — humans send."
        />
      </Card>
    </div>
  );
}
