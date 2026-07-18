import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { styleProfiles } from "@/db/schema";

/** "Email style profile" card (WO-04 task 10) with the fine-tune-later copy. */
export async function StyleProfileCard() {
  const profile = await db.query.styleProfiles.findFirst({ where: eq(styleProfiles.persona, "cole") });
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">Email style profile</p>
      {profile ? (
        <div className="mt-1.5 space-y-1 text-[10px] leading-relaxed text-ink-muted">
          <p>
            Learned from {profile.sourceEmailIds.length} sent emails · signs{" "}
            <span className="font-mono text-ink">{profile.card.signoff}</span>
          </p>
          <p className="text-ink-faint">{profile.card.register}</p>
          <p className="border-t border-line pt-1.5 text-[9px] text-ink-faint">
            Production path: per-rep fine-tune trained on your approval edits.
          </p>
        </div>
      ) : (
        <p className="mt-1.5 text-[10px] leading-relaxed text-ink-faint">
          Builds from the sent corpus on first draft.
        </p>
      )}
    </div>
  );
}
