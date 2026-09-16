import { describe, it, expect } from "vitest";
import { formatDate, formatDateLong, normalizeIsoOffset, resolveEventStartDate, toValidDate } from "../formatDate";

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

describe("toValidDate / normalizeIsoOffset — ISO 8601 « PHP » (offset sans deux-points)", () => {
  it("normalise +0200 en +02:00 (forme de startDateSortFormat/endDateSortFormat de search/agenda)", () => {
    expect(normalizeIsoOffset("2026-08-14T09:00:00+0200")).toBe("2026-08-14T09:00:00+02:00");
    expect(normalizeIsoOffset("2026-08-14T09:00:00-0400")).toBe("2026-08-14T09:00:00-04:00");
    expect(normalizeIsoOffset("2026-08-14T09:00:00.123+0000")).toBe("2026-08-14T09:00:00.123+00:00");
  });

  it("laisse intacts un Z, un offset déjà normalisé et une chaîne non ISO", () => {
    expect(normalizeIsoOffset("2026-08-14T09:00:00Z")).toBe("2026-08-14T09:00:00Z");
    expect(normalizeIsoOffset("2026-08-14T09:00:00+02:00")).toBe("2026-08-14T09:00:00+02:00");
    expect(normalizeIsoOffset("14/08/2026 9:00")).toBe("14/08/2026 9:00");
  });

  it("toValidDate parse la forme PHP en Date valide (instant exact)", () => {
    expect(toValidDate("2026-08-14T09:00:00+0200")?.toISOString()).toBe("2026-08-14T07:00:00.000Z");
    expect(toValidDate(" 2026-08-14T09:00:00+0000 ")?.toISOString()).toBe("2026-08-14T09:00:00.000Z");
  });
});
