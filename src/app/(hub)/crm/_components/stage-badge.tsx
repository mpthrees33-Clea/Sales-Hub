import { StatusPill } from "@/components/ui";
import { STAGE_LABEL, stageTone, type Stage } from "@/lib/crm-stages";

/** Opportunity stage rendered as a toned pill. Shared by list + pipeline. */
export function StageBadge({ stage }: { stage: Stage }) {
  return <StatusPill tone={stageTone(stage)}>{STAGE_LABEL[stage]}</StatusPill>;
}
