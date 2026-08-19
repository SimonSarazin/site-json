import { describe, it, expect } from "vitest";
import type { Event } from "@communecter/cocolight-api-client";
import { eventTimeBucket, partitionByTime } from "./partitionByTime";

const NOW = new Date("2026-06-15T12:00:00Z");
const ev = (start: string, end?: string) =>
  ({ serverData: { startDate: new Date(start), ...(end ? { endDate: new Date(end) } : {}) } }) as unknown as Event;

describe("eventTimeBucket", () => {
  it("passé : end < now", () => expect(eventTimeBucket(new Date("2026-06-10"), new Date("2026-06-11"), NOW)).toBe("past"));
  it("à venir : start > now", () => expect(eventTimeBucket(new Date("2026-06-20"), null, NOW)).toBe("upcoming"));
  it("en cours : start ≤ now ≤ end", () => expect(eventTimeBucket(new Date("2026-06-14"), new Date("2026-06-16"), NOW)).toBe("ongoing"));
  it("ponctuel sans end, futur → upcoming", () => expect(eventTimeBucket(new Date("2026-06-20"), null, NOW)).toBe("upcoming"));
  it("ponctuel sans end, passé → past", () => expect(eventTimeBucket(new Date("2026-06-10"), null, NOW)).toBe("past"));
  it("ponctuel pile maintenant → ongoing (start ≤ now ≤ start)", () => expect(eventTimeBucket(NOW, null, NOW)).toBe("ongoing"));
});

describe("partitionByTime", () => {
  it("répartit en ongoing/upcoming/past et ignore les events sans date", () => {
    const events: Event[] = [
      ev("2026-06-20"),                 // upcoming
      ev("2026-06-14", "2026-06-16"),   // ongoing
      ev("2026-06-01", "2026-06-02"),   // past
      ({ serverData: {} } as unknown as Event), // sans date → ignoré
    ];
    const { ongoing, upcoming, past } = partitionByTime(events, NOW);
    expect(upcoming).toHaveLength(1);
    expect(ongoing).toHaveLength(1);
    expect(past).toHaveLength(1);
  });

  it("utilise startDateSort (récurrent sans startDate)", () => {
    const recurring = ({ serverData: { startDateSort: "2026-06-20T09:00:00Z" } } as unknown as Event);
    const { upcoming } = partitionByTime([recurring], NOW);
    expect(upcoming).toHaveLength(1);
  });

  it("récurrent SANS endDate, dans son créneau (openingHours) au moment de now → ongoing (pas ignoré)", () => {
    // NOW = 2026-06-15T12:00:00Z, un lundi. Sans dérivation de `end` depuis `openingHours`
    // (cf. eventDates.ts), cet event resterait sans bucket "ongoing" atteignable (end == start < now).
    const recurring = ({
      serverData: {
        startDateSortFormat: "2026-06-15T08:00:00Z",
        openingHours: [{ dayOfWeek: "Mo", hours: [{ opens: "08:00", closes: "19:00" }] }],
      },
    } as unknown as Event);
    const { ongoing } = partitionByTime([recurring], NOW);
    expect(ongoing).toHaveLength(1);
  });
});
