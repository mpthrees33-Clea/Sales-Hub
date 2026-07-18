/** CalendarProvider — Graph-shaped, read-only in this build. */
export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  lat: number | null;
  lng: number | null;
  accountId: string | null;
  projectId: string | null;
  prepNotes: string | null;
  status: "scheduled" | "completed" | "cancelled";
};

export interface CalendarProvider {
  listEvents(range: { start: Date; end: Date }): Promise<CalendarEvent[]>;
}
