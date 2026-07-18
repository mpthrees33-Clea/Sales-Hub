import { Image } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Scenes</h1>
      <Card>
        <EmptyState
          icon={Image}
          title="No room scenes generated"
          copy="Pick a finish, pick a room photo, and generate a photoreal applied scene. User-triggered, capped, cost-visible."
        />
      </Card>
    </div>
  );
}
