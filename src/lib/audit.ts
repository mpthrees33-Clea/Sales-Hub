/**
 * The single write path into audit_log (docs/02-SECURITY-FRAMEWORK.md §2.5).
 * No update or delete function for audit_log exists anywhere in app code —
 * the table is append-only by construction. Store refs in `detail`, never
 * full bodies.
 */
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { getDemoNow } from "@/lib/demo-clock";

export type AuditActor = `agent:${string}` | `user:${string}` | "system";

export async function audit(entry: {
  actor: AuditActor;
  action: string;
  objectType?: string;
  objectId?: string;
  detail?: Record<string, unknown>;
}): Promise<{ id: string }> {
  let demoAt: Date | null = null;
  try {
    demoAt = await getDemoNow();
  } catch {
    // Pre-seed bootstrap: demo_state may not exist yet; audit still records.
  }
  const [row] = await db
    .insert(auditLog)
    .values({
      actor: entry.actor,
      action: entry.action,
      objectType: entry.objectType,
      objectId: entry.objectId,
      detail: entry.detail,
      demoAt,
    })
    .returning({ id: auditLog.id });
  return row!;
}
