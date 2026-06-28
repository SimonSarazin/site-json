import { describe, it, expect } from "vitest";
import { Temporal } from "temporal-polyfill";
import type { Event } from "@communecter/cocolight-api-client";
import { mapEventsToCalendar } from "./mapEventToCalendar";

const ev = (id: string, sd: Record<string, unknown>) => ({ serverData: { id, ...sd } }) as unknown as Event;

describe("mapEventsToCalendar", () => {
  it("mappe id/title/calendarId + start/end Temporal ; entityMap renseigné", () => {
    const e = ev("e1", { name: "Atelier", type: "workshop", startDate: new Date("2026-06-20T09:00:00Z"), endDate: new Date("2026-06-20T11:00:00Z") });
    const { calendarEvents, entityMap } = mapEventsToCalendar([e]);
    expect(calendarEvents).toHaveLength(1);
    const c = calendarEvents[0];
    expect(c.id).toBe("e1");
    expect(c.title).toBe("Atelier");
    expect(c.calendarId).toBe("workshop");
    expect(c.start).toBeInstanceOf(Temporal.ZonedDateTime);
    expect(c.end).toBeInstanceOf(Temporal.ZonedDateTime);
    expect(entityMap.get("e1")).toBe(e);
  });

  it("sans endDate → fin = début + 1h", () => {
    const e = ev("e2", { name: "Point", startDate: new Date("2026-06-20T09:00:00Z") });
    const { calendarEvents } = mapEventsToCalendar([e]);
    const c = calendarEvents[0];
    expect(c.calendarId).toBe("others"); // type absent → fallback
    expect(c.end.epochMilliseconds - c.start.epochMilliseconds).toBe(3600_000);
  });

  it("ignore les events sans date + déduplique par id", () => {
    const noDate = ev("e3", { name: "X" });
    const dupA = ev("e4", { name: "A", startDate: new Date("2026-06-20T09:00:00Z") });
    const dupB = ev("e4", { name: "A bis", startDate: new Date("2026-06-21T09:00:00Z") });
    const { calendarEvents } = mapEventsToCalendar([noDate, dupA, dupB]);
    expect(calendarEvents.map((c) => c.id)).toEqual(["e4"]);
  });
});
