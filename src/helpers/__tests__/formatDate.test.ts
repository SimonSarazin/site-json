import { describe, it, expect } from "vitest";
import { formatDate, formatDateLong, resolveEventStartDate } from "../formatDate";

describe("formatDate / formatDateLong", () => {
  // Date-time AVEC offset implicite local (le jour ne bascule pas).
  const d = new Date("2026-06-14T15:30:00");

  it("formatDate : date longue fr AVEC heure", () => {
    const s = formatDate(d);
    expect(s).toContain("14 juin 2026");
    expect(s).toMatch(/\d{2}:\d{2}/); // heure incluse
  });

  it("formatDateLong : date longue fr SANS heure (source unique Blog/Timeline)", () => {
    expect(formatDateLong(d)).toBe("14 juin 2026");
    expect(formatDateLong(d)).not.toMatch(/\d{2}:\d{2}/);
  });

  it("accepte Date | string | number", () => {
    expect(formatDateLong("2026-06-14T15:30:00")).toBe("14 juin 2026");
    expect(formatDateLong(d.getTime())).toBe("14 juin 2026");
  });
});

describe("resolveEventStartDate", () => {
  it("ponctuel : startDate", () => {
    expect(resolveEventStartDate({ startDate: "2026-08-14T09:00:00Z" })?.toISOString()).toBe("2026-08-14T09:00:00.000Z");
  });

  it("récurrent : startDateSort en objet PHP brut (forme réelle backend) → ignoré, repli sur startDateSortFormat", () => {
    expect(
      resolveEventStartDate({
        startDateSort: { date: "2026-08-14 09:00:00.000000", timezone_type: 3, timezone: "Europe/Paris" },
        startDateSortFormat: "2026-08-14T09:00:00+0200",
      })?.toISOString(),
    ).toBe("2026-08-14T07:00:00.000Z");
  });

  it("aucune date exploitable → null", () => {
    expect(resolveEventStartDate({})).toBeNull();
  });
});
