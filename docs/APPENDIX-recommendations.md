# Appendix — Recommendations, Corrections & Roadmap

> You asked: "do your research, tell me where I'm off, tell me what could be
> better." Here it is, straight.

---

## 1. What you got right (keep these instincts)

- **Outlook/Azure over Gmail.** Commercial construction is a Microsoft world,
  and you corrected to this yourself mid-brief. Bonus: it aligns the demo with
  the enterprise buyers Clea wants. (Demo mode simulates the mailbox; the
  Graph swap is an interface change, not a rewrite.)
- **Drafts-for-review, never auto-send.** This is the proven industry norm
  (Superhuman, Fyxer, Jace all refuse to auto-send) AND your differentiation
  against Salesforce Agentforce's act-without-approval posture. You landed on
  the right trust model by rep instinct.
- **Demo-first honesty.** Building this as a controllable, seeded demo rather
  than a half-real product is the correct call for a promo video and for sales
  conversations. Flaky OAuth on camera kills videos.
- **The morning narrative.** "2 hours → 10 minutes" is a measurable, filmable,
  believable claim. Research backs the pain: field reps spend ~65% of time on
  non-selling work and ~21 hrs/week driving.

## 2. Where you were off (corrections already baked into this plan)

1. **"Agents all throughout it" is the wrong mental model.** Scattering agents
   makes an unmaintainable demo and an unconvincing security story. The plan
   builds ONE harness (`defineAgent` + Permissioned Tools + policy gate +
   audit) and nine instances. That matches your own site's thesis — "the model
   is 10% of the system" — and it's what an enterprise security reviewer will
   actually respect.
2. **"Emails auto-drafted in my tone" ≠ a fine-tune by tomorrow.** Your site
   sells "Email Fine-tune (on-prem model trained on real drafts)". You cannot
   train that overnight, and you don't need to for the demo: a style-profile
   distilled from ~30 seeded sent emails, injected few-shot, is
   indistinguishable on camera. Crucially, the approval inbox records every
   human edit as a diff — that IS the future fine-tuning dataset. Demo the
   flywheel, ship the fine-tune later.
3. **You underweighted the approval inbox.** Your brief treats review as a
   detail ("I can go in and approve it"). It's the hero. Every agent's output
   converges there; it's where trust is demonstrated and where the
   2-hours→10-minutes montage physically happens. It got the deepest UX spec
   in the pack (WO-03): keyboard-first, draft-ahead, fast EDIT path (research:
   most drafts get tweaked, not rubber-stamped), batch-approve only low-risk.
4. **You missed the biggest vertical pain: submittal packages.** 8–12 hours
   each, uniquely construction, untouched by every horizontal AI sales tool
   (Gong, Sybill, Attention, Rox…). It's now WO-14 and a demo beat
   ("8 hours → 4 minutes"). Between quote-speed, samples, and submittals, your
   moat is the vertical — not transcription or summaries, which are commodity.
5. **Meeting capture: don't send a bot.** For client-facing construction sales,
   bot-free local recording (phone mic, Granola-style) is the trust-preserving
   pattern; diarized transcription (AssemblyAI/Deepgram) does the rest. Bots
   (Recall.ai) are a later option for virtual meetings only.
6. **Room scenes are a garnish, not a pillar.** Impressive on camera
   (Gemini's image model is genuinely strong at photoreal interiors), but keep
   image gen behind explicit user action with cost caps, and pre-generate the
   scripted hero scenes. Never let batch agents burn image spend overnight.
7. **"Google Maps calendar for my whole day" needs one correction:** the
   shareable Maps link can't optimize stop order itself and caps around 9
   waypoints. So the hub computes the optimized order + leave-by times
   server-side (Routes API), then hands you a pre-ordered link. Same experience
   you wanted, correct mechanics.

## 3. Optimizations worth knowing about

- **Quote latency is a sales weapon, not a feature.** 78% of B2B buyers go with
  the first responder. The UI surfaces "drafted N minutes after receipt" on
  every quote — say that number out loud in the video.
- **Make security the marketing.** The audit trail, scoped-tool badges,
  seven-layer validation checklist, and "Drafts only — humans send" aren't
  compliance chores; they're the demo's closing argument and map cleanly to
  OWASP LLM Top-10 (2025) language enterprise reviewers recognize.
- **The overnight run doubles as a live wow.** Because "Simulate Overnight" is
  the real workflow on a demo clock, you can run it live in front of a
  prospect, not just in the video.
- **Track spec-in explicitly.** The pipeline includes a `specified_bod`
  (basis-of-design) stage — architect-motion selling is different from
  distributor-motion selling, and showing you model that difference is instant
  credibility with anyone who's carried a bag in this industry.

## 4. Roadmap after the demo (in order)

1. **Real Microsoft Graph**: Entra app registration; delegated scopes
   `Mail.Read`, `Mail.ReadWrite` (drafts), `Calendars.Read`; delta queries for
   sync (webhooks later); drafts created in the rep's real Outlook so approval
   can also happen from Outlook itself. The `EmailProvider` interface in WO-01
   was shaped for exactly this swap.
2. **Email fine-tune, for real**: export approvals.edits diffs + sent corpus →
   preference/fine-tune dataset → hosted tune (or on-prem per the site's
   positioning). The demo has been collecting the data from day one.
3. **ERP integration ladder**: CSV/SFTP import → QuickBooks Online →
   NetSuite/SAP B1 (Service Layer), optionally brokered via iPaaS. The seeded
   schema mirrors these entities on purpose.
4. **Multi-rep + RBAC + SSO (Entra)**: manager roll-ups, territory views;
   the audit/approval model already supports multiple actors.
5. **Virtual-meeting capture** (Recall.ai or Teams transcript API) alongside
   in-person recording.
6. **SOC 2 track**: the audit log, approval objects, least-privilege scopes,
   and PII-redaction habits in this build are the evidence collection for it.

## 5. Cost reality check (demo scale)

Model spend via AI Gateway at demo volume is trivial: nightly run ≈ 15–25
Sonnet/Haiku calls (cents), PO extraction cents per document, transcription
~$0.15–0.26/meeting-hour, room scene ~$0.13–0.25/image (capped, user-triggered),
Maps effectively free at rep volume. The demo's real cost is build time —
which is why the pack is cut into parallelizable work orders.
