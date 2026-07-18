import { and, asc, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { meetings } from "@/db/schema";
import type { CalendarEvent, CalendarProvider } from "./types";

export class DemoCalendarProvider implements CalendarProvider {
  async listEvents(range: { start: Date; end: Date }): Promise<CalendarEvent[]> {
    const rows = await db
      .select()
      .from(meetings)
      .where(and(gte(meetings.startsAt, range.start), lte(meetings.startsAt, range.end)))
      .orderBy(asc(meetings.startsAt));
    return rows.map((m) => ({
      id: m.id,
      title: m.title,
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      location: m.location,
      lat: m.lat,
      lng: m.lng,
      accountId: m.accountId,
      projectId: m.projectId,
      prepNotes: m.prepNotes,
      status: m.status,
    }));
  }
}
