import type {
  Project, ProjectExtensions, Activity, Customer, Quote,
  Rep,
} from '../types';

// AI opportunity summary generator. Reads the project + its activity stream
// and produces a "where this was last left + what to do next" summary. Used
// by the CRM detail panel; one LLM call per refresh, deterministic fallback
// when no API key is configured.

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type ExtendedProject = Project & ProjectExtensions;

export interface OpportunitySummary {
  summary: string;            // 2-3 sentence "what's the state" recap
  suggestedNextStep: string;  // single-sentence action-oriented next step
  dormancyAlert?: string;     // optional warning when quiet too long
}

export interface OpportunitySummaryContext {
  project: ExtendedProject;
  rep: Rep;
  customer?: Customer;
  architect?: Customer;
  gc?: Customer;
  developer?: Customer;
  activities: Activity[];
  quotes: Quote[];
}

export function isOpportunityAIConfigured(): boolean {
  return Boolean(GEMINI_API_KEY);
}

function daysAgo(iso: string | undefined): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ── Deterministic fallback ────────────────────────────────────
// Used when the API key is missing or the call fails. Produces plausible
// summary text from the structured fields alone — no LLM required.
function generateFallbackSummary(ctx: OpportunitySummaryContext): OpportunitySummary {
  const p = ctx.project;
  const stageLabel = (p.opportunityStage ?? 'lead_qualification').replace(/_/g, ' ');
  const lastTouch = daysAgo(p.lastTouchAt);

  // Sort activities newest-first; take the most recent meaningful one.
  const sortedActivities = [...ctx.activities].sort((a, b) => b.date.localeCompare(a.date));
  const lastActivity = sortedActivities[0];

  let summary = `${p.name} is in the ${stageLabel} stage`;
  if (ctx.customer) summary += ` with ${ctx.customer.company}`;
  if (lastActivity) {
    summary += `. Last touch was ${lastTouch}d ago — ${lastActivity.summary}.`;
  } else if (p.notes.length > 0) {
    const last = p.notes[p.notes.length - 1];
    summary += `. Last touch was ${lastTouch}d ago — note: "${last.text.slice(0, 80)}".`;
  } else {
    summary += `. No recorded activity yet beyond initial entry.`;
  }
  if (ctx.quotes.length > 0) {
    summary += ` ${ctx.quotes.length} quote${ctx.quotes.length === 1 ? '' : 's'} on file.`;
  }

  // Stage-aware next step heuristics.
  let suggestedNextStep: string;
  switch (p.opportunityStage) {
    case 'lead_qualification':
      suggestedNextStep = ctx.architect
        ? `Send commercial catalog to ${ctx.architect.contacts[0]?.name ?? 'the architect'} and request a project scope call.`
        : `Confirm specifying architect and ship initial product literature.`;
      break;
    case 'design':
      suggestedNextStep = `Follow up on sample feedback; confirm color and finish so a formal quote can be prepared.`;
      break;
    case 'bidding':
      suggestedNextStep = ctx.gc
        ? `Confirm bid due date with ${ctx.gc.company} and verify final material specs.`
        : `Confirm GC, bid due date, and verify final material specs before submitting.`;
      break;
    case 'awarded':
      suggestedNextStep = `Confirm PO timing with ${ctx.gc?.company ?? 'GC'} and finalize ship-to logistics.`;
      break;
    case 'orders_pending':
      suggestedNextStep = `Track PO status and confirm anticipated order date (${p.anticipatedOrderDate ?? 'TBD'}).`;
      break;
    case 'orders_placed':
      suggestedNextStep = `Confirm install schedule and verify customer has received material on-site.`;
      break;
    case 'closed':
      suggestedNextStep = `Project closed — log final invoice and capture any lessons learned.`;
      break;
    default:
      suggestedNextStep = `Reach out to ${ctx.customer?.contacts[0]?.name ?? 'the primary contact'} for a status check.`;
  }

  if (p.nextStep) {
    // If the rep already wrote a next step, defer to that as the suggestion.
    suggestedNextStep = p.nextStep;
  }

  const dormancyAlert = lastTouch >= 90
    ? `Dormant ${lastTouch}d. Strongly recommend a re-engagement touch this week.`
    : lastTouch >= 30 && p.opportunityStatus === 'active'
    ? `Quiet ${lastTouch}d on an active opportunity — worth a check-in.`
    : undefined;

  return { summary, suggestedNextStep, dormancyAlert };
}

// ── LLM-backed generator ──────────────────────────────────────
async function generateWithLLM(
  ctx: OpportunitySummaryContext,
  signal?: AbortSignal,
): Promise<OpportunitySummary> {
  if (!GEMINI_API_KEY) throw new Error('VITE_GEMINI_API_KEY not configured');

  const p = ctx.project;
  const lastTouchDays = daysAgo(p.lastTouchAt);

  // Compact context — last 8 activities, last 4 notes, headline stakeholders.
  const sortedActivities = [...ctx.activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const recentNotes = p.notes.slice(-4);

  const projectBlob = {
    name: p.name,
    opportunityId: p.opportunityId,
    type: p.projectType,
    stage: p.opportunityStage,
    status: p.opportunityStatus,
    value: p.value,
    jobLocation: p.jobLocation,
    anticipatedOrderDate: p.anticipatedOrderDate,
    lastTouchDays,
    bidderCount: (p.bidders ?? []).length,
    quoteCount: ctx.quotes.length,
    nextStepCurrentlyOnFile: p.nextStep ?? null,
  };

  const stakeholdersBlob = {
    customer: ctx.customer ? `${ctx.customer.company} (${ctx.customer.type})` : null,
    architect: ctx.architect?.company ?? null,
    gc: ctx.gc?.company ?? null,
    developer: ctx.developer?.company ?? null,
  };

  const systemPrompt = `You are a sales operations analyst at Trinity Surfaces. You write brief, action-oriented status recaps for a sales rep so they can immediately get back into an opportunity that's been on hold.

OUTPUT — VALID JSON only, matching this exact shape:
{"summary": "...", "suggestedNextStep": "...", "dormancyAlert": "..." or null}

RULES
- summary: 2–3 short sentences. Where the opportunity was left, what's been done, who's involved, what's pending. Past tense. Use concrete details (dates, $, quote counts, project names) — no fluff.
- suggestedNextStep: 1 sentence. Action-oriented (start with a verb), specific to the stage and the most recent activity. Examples: "Follow up with [contact] on the bid submission deadline." / "Request the architect's revised palette before Friday." / "Confirm color choice with [GC] so the formal quote can ship."
- dormancyAlert: include only when the opportunity has been quiet >30 days on an active status, OR >90 days regardless. Keep it short and motivating ("Quiet 47 days — worth a check-in" or "Dormant 6 months on a $185k spec — re-engage this week"). Otherwise return null.
- Names: use real names from the input ("Sandra at Verity", "Beth at Stafford"), never "the contact" or "the customer". If a name isn't available, fall back to company.
- Be honest: if there's no activity, say so. Don't invent activities.`;

  const userPrompt = `Project record:
${JSON.stringify(projectBlob, null, 2)}

Stakeholders:
${JSON.stringify(stakeholdersBlob, null, 2)}

Recent activities (newest first):
${sortedActivities.length === 0 ? '(none)' : sortedActivities.map((a) => `- ${a.date.slice(0, 10)} [${a.type}] ${a.summary}`).join('\n')}

Recent notes (newest last):
${recentNotes.length === 0 ? '(none)' : recentNotes.map((n) => `- ${n.date} [${n.author}] ${n.text}`).join('\n')}

Rep: ${ctx.rep.name}

Write the recap.`;

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') ?? '';
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Gemini returned non-JSON: ${trimmed.slice(0, 200)}`);
  }

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    suggestedNextStep: typeof parsed.suggestedNextStep === 'string' ? parsed.suggestedNextStep.trim() : '',
    dormancyAlert: typeof parsed.dormancyAlert === 'string' && parsed.dormancyAlert.trim()
      ? parsed.dormancyAlert.trim()
      : undefined,
  };
}

// ── Top-level entrypoint ──────────────────────────────────────
export async function buildOpportunitySummary(
  ctx: OpportunitySummaryContext,
  signal?: AbortSignal,
): Promise<OpportunitySummary> {
  if (isOpportunityAIConfigured()) {
    try {
      return await generateWithLLM(ctx, signal);
    } catch (err) {
      console.warn('Opportunity AI fell back to deterministic generator:', err);
    }
  }
  return generateFallbackSummary(ctx);
}
