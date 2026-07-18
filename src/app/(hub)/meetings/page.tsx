import { Mic } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Meetings</h1>
      <Card>
        <EmptyState
          icon={Mic}
          title="No meetings recorded"
          copy="Record on your phone after a site walk — diarized transcript, CRM deltas, and a follow-up draft in minutes."
        />
      </Card>
    </div>
  );
}
