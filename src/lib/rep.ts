/**
 * The single demo rep persona (docs/04-DEMO-DATA.md §1). There is no users
 * table; `approvals.approver_user_id` and audit actors use this fixed id.
 */
export const REP = {
  id: "8f5a1c2e-0000-4000-8000-c01e00000001",
  name: "Cole Mercer",
  firstName: "Cole",
  email: "cole.mercer@meridian-surfaces.example.com",
  phone: "(704) 555-0147",
  company: "Meridian Surfaces Co.",
  title: "Territory Sales Representative",
  tz: "America/New_York",
  /** Home base for route origin: Meridian Surfaces Charlotte office. */
  homeBase: {
    label: "Meridian Surfaces Co. — Charlotte Office",
    address: { line1: "4210 Stuart Andrew Blvd", city: "Charlotte", state: "NC", zip: "28217" },
    lat: 35.1847,
    lng: -80.8891,
  },
} as const;

export const REP_ACTOR = `user:${REP.id}`;
