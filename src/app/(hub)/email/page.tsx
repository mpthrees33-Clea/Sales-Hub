import { Mail } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Email</h1>
      <Card>
        <EmptyState
          icon={Mail}
          title="Inbox synced, nothing to review"
          copy="Triage runs metadata-first over inbound mail. Noise is archived visibly; drafts route to Approvals."
        />
      </Card>
    </div>
  );
}
