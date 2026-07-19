/** "Draft ready" chip — jumps from a thread to its email_draft approval (WO-04 task 8). */
import Link from "next/link";
import { MailCheck } from "lucide-react";

export function DraftReadyChip({ approvalId }: { approvalId: string }) {
  return (
    <Link
      href={`/approvals?id=${approvalId}`}
      className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-dim px-2 py-0.5 font-mono text-[10px] text-accent transition-colors hover:border-accent"
      title="Draft ready — review in Approvals"
    >
      <MailCheck className="h-3 w-3" /> draft ready
    </Link>
  );
}
