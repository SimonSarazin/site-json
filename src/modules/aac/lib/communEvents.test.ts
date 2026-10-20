import { describe, expect, it } from "vitest";
import { formatDate } from "@/helpers/formatDate";
import { toCommunEventRow } from "./communEvents";

const NOW = new Date("2026-10-01T10:00:00Z");

/** `t` de `modules/search` réduit à ce que lit le libellé de récurrence. */
const tSearch = (key: string, _fallback?: string, params?: Record<string, unknown>) =>
  key === "card.event.recurring" ? `Chaque ${String(params?.days)}` : key === "card.event.recurringAnd" ? "et" : key.replace("days.", "");

const event = (serverData: Record<string, unknown>, id = "e1") => ({ id, serverData }) as never;

describe("toCommunEventRow", () => {
  it("un événement ponctuel à venir : date, commune, lien", () => {
    const start = new Date("2026-10-04T08:00:00Z");
    const row = toCommunEventRow(
      event({ name: "Chantier participatif", slug: "chantier", startDate: start, address: { addressLocality: "Sainte-Rose" } }),
      NOW,
      tSearch,
    );

    expect(row).toEqual({
      id: "e1",
      name: "Chantier participatif",
      slug: "chantier",
      when: formatDate(start),
      locality: "Sainte-Rose",
      isOngoing: false,
    });
  });

  it("en cours : commencé et pas encore fini", () => {
    const row = toCommunEventRow(
      event({ name: "Atelier", startDate: new Date("2026-10-01T08:00:00Z"), endDate: new Date("2026-10-01T12:00:00Z") }),
      NOW,
      tSearch,
    );
    expect(row.isOngoing).toBe(true);
  });

  it("récurrent : le libellé de récurrence remplace la date", () => {
    const row = toCommunEventRow(
      event({
        name: "Permanence",
        recurrency: true,
        openingHours: [{ dayOfWeek: "We", hours: [{ opens: "14:00", closes: "17:00" }] }],
        startDateSortFormat: "2026-10-07T14:00:00+04:00",
      }),
      NOW,
      tSearch,
    );
    expect(row.when).toBe("Chaque wednesday");
  });

  it("sans slug, sans adresse, sans date : champs vides, pas d'erreur", () => {
    expect(toCommunEventRow(event({ name: "  ", slug: "" }), NOW, tSearch)).toEqual({
      id: "e1",
      name: "",
      slug: null,
      when: "",
      locality: null,
      isOngoing: false,
    });
  });
});
