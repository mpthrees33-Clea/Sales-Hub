/**
 * Evidence accumulation ("Every answer shows its source"). Tools return
 * {data, evidence[]}; the harness collects evidence across a run and attaches
 * it to the run output and to any approval the run creates.
 */
import type { Evidence } from "@/db/schema";

export type { Evidence };

export class EvidenceAccumulator {
  private items: Evidence[] = [];

  add(...evidence: Evidence[]): void {
    for (const e of evidence) {
      // De-dupe identical refs so repeated tool calls don't spam chips.
      const key = JSON.stringify([e.type, e.ref]);
      if (!this.items.some((x) => JSON.stringify([x.type, x.ref]) === key)) {
        this.items.push(e);
      }
    }
  }

  all(): Evidence[] {
    return [...this.items];
  }
}
