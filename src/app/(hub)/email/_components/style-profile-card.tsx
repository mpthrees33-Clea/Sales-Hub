/**
 * Email style-profile card (WO-04 task 10). Renders the learned StyleCard and
 * states the fine-tune-later path verbatim. Building lazily on first view keeps
 * the seed idempotent (no random run id written at seed time).
 */
import { Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { getStyleCard, getStyleProfileMeta } from "@/lib/style/profile";

export async function StyleProfileCard() {
  const card = await getStyleCard();
  const meta = await getStyleProfileMeta();

  return (
    <Card>
      <CardHeader
        title="Email style profile"
        n="04"
        right={<Sparkles className="h-3.5 w-3.5 text-accent" />}
      />
      <div className="space-y-2.5 p-4 text-[12px]">
        <p className="text-ink-muted">
          Learned from {meta?.sourceCount ?? 0} sent emails · avg {card.avgLengthWords} words · signs{" "}
          <span className="font-mono text-ink">{card.signoff}</span>
        </p>
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">Prefers</p>
          <div className="flex flex-wrap gap-1">
            {card.phrasePreferences.slice(0, 6).map((p) => (
              <span key={p} className="rounded border border-line bg-surface2 px-1.5 py-0.5 text-[10px] text-ink-muted">“{p}”</span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">Avoids</p>
          <div className="flex flex-wrap gap-1">
            {card.avoid.slice(0, 5).map((p) => (
              <span key={p} className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint line-through">{p}</span>
            ))}
          </div>
        </div>
        <p className="border-t border-line pt-2 text-[10px] leading-relaxed text-ink-faint">
          Production path: per-rep fine-tune trained on your approval edits.
        </p>
      </div>
    </Card>
  );
}
