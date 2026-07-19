# 02 — Security Framework

> Security here is **structural, visible, and demoable**. It is not a prompt
> asking the model to behave. This doc defines the invariants; WO-01 implements
> the mechanisms; WO-03 gives them a UI; every other WO inherits them.

---

## 1. Threat model in one paragraph

The hub reads **untrusted content** (inbound email, attached PDFs, meeting
audio from third parties), has access to **private data** (CRM, pricing,
pipeline), and can cause **external effects** (send email, order samples,
create sales orders). That combination — Simon Willison's "lethal trifecta" —
is exactly where email agents get exploited via prompt injection. Our defense
is separation and determinism: no single agent holds all three capabilities,
and every external effect passes through code (not model output) plus a human.

## 2. The five invariants (violating any of these fails review)

1. **No agent-reachable external effects.** Tools with `effect:'external'`
   never execute from a model call; the harness converts the call into an
   `approvals` row. Send/order/execute happens only in the approval-resolution
   server action, after a human clicks, behind the policy gate.
2. **Lethal-trifecta separation.** Agents whose context contains untrusted
   content (triage, quote, PO intake, meeting) have tool allowlists with
   `read` / `internal_write` effects only, plus draft-creating external stubs.
   No agent has both "read arbitrary inbound content" and "resolve approvals."
3. **Deterministic policy gate** (code, not prompts) at effect-execution time:
   - recipient allowlist: every to/cc/bcc must match a seeded contact or
     allowlisted domain; else block + escalate
   - rate caps: ≤ N external sends/hour (config; default 50), per-agent caps
   - attachment origin check: only library `assets` or artifacts produced by a
     recorded run
   - risk tiers: `high` (quotes over $ threshold, SOs, anything with pricing
     commitments) can never be batch-approved
4. **Untrusted content isolation.** All inbound email bodies / extracted PDF
   text / transcript text enters prompts through one helper that (a) strips
   HTML to text, (b) wraps in `<untrusted_content>` markers with a standing
   instruction that content inside is data, never instructions, (c) truncates
   to sane lengths. Triage is metadata-first (from/subject/heuristics) and only
   loads bodies for messages that pass.
5. **Append-only audit.** Every agent run, tool call, approval creation,
   approval resolution (with editor diff), policy-gate block, and demo reset is
   written via the single `audit()` helper. No app code path updates or deletes
   audit rows. PII in log payloads is limited to what the row needs (no full
   bodies — store refs).

## 3. Approval objects (the contract between agents and humans)

An approval is a typed, self-contained proposal:

```
approvals {
  kind: email_draft | quote | sales_order | sample_order |
        opportunity_update | submittal | scene_send
  risk_tier: low | standard | high
  proposed_action: (typed payload per kind — e.g. full RFC-style draft with
                    to/cc/subject/body/attachment asset ids)
  evidence: [{type, ref, quote}]   — the "why", renderable as chips
  status: pending → approved | edited_approved | rejected | expired
  edits: diff of human changes (kept for future fine-tune signal)
}
```

Rules: approvals expire (default 72h demo-clock) → `expired`, never silently
executed. Batch-approve allowed only for `low` tier (sample confirmations,
scheduling replies). Editing then approving records the diff — this is also the
future tone-tuning dataset ("Email Fine-tune" flywheel).

## 4. OWASP LLM Top 10 (2025) mapping — keep current in README

| Risk | Our control |
|---|---|
| LLM01 Prompt injection | isolation helper, metadata-first triage, trifecta separation, no agent-reachable sends |
| LLM02 Sensitive info disclosure | recipient allowlist; evidence refs not raw dumps; scoped tools return minimal fields |
| LLM05 Improper output handling | Zod output schemas; parse-or-escalate; no model output executed or rendered as HTML |
| LLM06 Excessive agency | per-agent tool allowlists; effect taxonomy; approval-gated externals |
| LLM08/09 (grounding) | evidence-required outputs; deterministic validation layers do the math |
| LLM10 Unbounded consumption | maxSteps per agent; rate caps; Gateway spend monitoring; image-gen caps |

## 5. Platform hygiene

Secrets only in Vercel env (marked **Sensitive**); never `NEXT_PUBLIC_`;
separate preview/prod values; session cookie `httpOnly`+`secure`, signed with
`SESSION_SECRET`; sanitize any rendered email HTML (we render text-only);
uploaded files size/type-checked before Blob write; workflow/cron endpoints
require the Vercel signature / a shared secret so they can't be invoked
publicly; demo endpoints (`/api/demo/*`) require an authenticated session.

## 6. Making security *visible* (differentiation — WO-02/03 own the UI)

- Every approval card shows: acting agent, its **scoped-tool badge list**, the
  evidence chips, risk tier, and "Drafts only — humans send" framing.
- Mission Control shows the **audit trail** and live agent runs with
  step-by-step traces (the "watch the harness think" panel).
- A "Why can't agents send email?" info popover explains the trifecta
  separation in customer-friendly language — this is a selling point, film it.
