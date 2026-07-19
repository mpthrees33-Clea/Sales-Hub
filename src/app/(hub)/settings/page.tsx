import { Settings } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Settings</h1>
      <Card>
        <EmptyState
          icon={Settings}
          title="Demo instance"
          copy="Single rep persona. Entra ID SSO is the documented production path."
        />
      </Card>
    </div>
  );
}
