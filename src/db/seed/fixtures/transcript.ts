/**
 * Pre-baked diarized transcript — Monday's Harborview Medical Ph2 site walk
 * (docs/04 §2). Feeds the meeting-followup and opportunity-update beats: the
 * customer asks for Walnut Grain pricing and two PDS docs, and mentions a
 * Phase 3 opportunity. Speaker labels are pre-mapped display names.
 */
import type { TranscriptSegment } from "@/db/schema";
import { skuOf } from "../data/catalog";

const WALNUT = skuOf("Walnut Grain");

export const HARBORVIEW_TRANSCRIPT: TranscriptSegment[] = [
  { speaker: "Cole", t0: 0, t1: 6, text: "Alright, recording so I don't lose anything. Second floor corridor, heading toward the nurse station." },
  { speaker: "Ray", t0: 6, t1: 14, text: "So this whole run gets the wood look. Architect's set says warm tone, and facilities wants something they can actually clean." },
  { speaker: "Cole", t0: 14, t1: 24, text: "That's exactly where the Walnut Grain sits — it's a film, so it wipes down, and it's Class A rated for a healthcare corridor like this." },
  { speaker: "Ray", t0: 24, t1: 33, text: "That's the one Calder flagged. OK. What I need from you is pricing on the walnut for this whole corridor package — both floors." },
  { speaker: "Cole", t0: 33, t1: 40, text: "I can have that to you tomorrow morning. Quantities off the finish schedule, priced at the project tier." },
  { speaker: "Ray", t0: 40, t1: 52, text: "Good. And the life-safety consultant wants documentation — send me the spec sheet and the install guide for the walnut so we can push it through the submittal review." },
  { speaker: "Cole", t0: 52, t1: 58, text: "Done — product data sheet and install guide, I'll attach both with the pricing." },
  { speaker: "Ray", t0: 58, t1: 70, text: "Nurse station fronts — we talked matte white on the casework. Facilities liked it. Keep that in the package as an alternate so the board sees both numbers." },
  { speaker: "Cole", t0: 70, t1: 76, text: "Walnut primary, matte white casework alternate. Easy." },
  { speaker: "Ray", t0: 76, t1: 90, text: "Between us — the board approved planning money for Phase 3 last week. Outpatient wing, breaks ground maybe next spring. Similar interior scope, probably bigger." },
  { speaker: "Cole", t0: 90, t1: 97, text: "That's great news. I'd love to get ahead of the spec on that one with Calder before it goes out." },
  { speaker: "Ray", t0: 97, t1: 108, text: "That's why I'm telling you. Get the Phase 2 package right and you're in good shape for it. Same team, probably same architect." },
  { speaker: "Cole", t0: 108, t1: 116, text: "Understood. So: walnut pricing for both corridor floors, spec sheet and install guide attached, matte white alternate on the casework." },
  { speaker: "Ray", t0: 116, t1: 126, text: "And copy Jenna on all of it — she's tracking the submittal log. If the docs are clean we can turn it in a week." },
  { speaker: "Cole", t0: 126, t1: 132, text: "Will do. I'll have everything to you and Jenna by end of day tomorrow." },
  { speaker: "Ray", t0: 132, t1: 140, text: "Perfect. Let's look at the elevator lobby on the way out — there's a soffit detail I want your opinion on." },
];

/** Referenced entities for the consistency check. */
export const TRANSCRIPT_REFS = {
  skus: [WALNUT],
  projects: ["Harborview Medical Phase 2"],
  contacts: ["Ray Delgado", "Jenna Fox"],
};
