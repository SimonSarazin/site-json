/**
 * Garde des codecs WRITE de dates d'EVENT (costum) — `eventDate:write` + `eventOpeningHours:write`
 * (sharedCodecs). Prouve, sans mutation ni navigateur, les corrections de la review :
 *  - RÉCURRENCY-AWARE : en récurrent, startDate/endDate rémanents sont OMIS ; en ponctuel, openingHours
 *    rémanent est OMIS → payload toujours cohérent malgré RHF shouldUnregister=false (findings A/C).
 *  - openingHours récurrent NORMALISÉ à EXACTEMENT 7 entrées Mo→Su (jour vide → "") — le contrat
 *    ADD_EVENT exige minItems:7/maxItems:7 (finding A : le composite n'émet que les jours cochés).
 *  - `.000Z` (sortie du composite) → offset local SANS millis (accepté par le legacy DataValidator).
 */
import { describe, it, expect } from "vitest";
import "./sharedRegistrations"; // side-effect : enregistre eventDate:write / eventOpeningHours:write
import { applyTransform } from "@/modules/formEngine/engine/transforms";

const w = (name: string, v: unknown, all: Record<string, unknown>) =>
  applyTransform(name, v, all as never);

describe("eventDate:write (recurrency-aware)", () => {
  it("RÉCURRENT → omet la date (undefined), même valeur ISO rémanente", () => {
    expect(w("eventDate:write", "2026-07-25T11:20:05.000Z", { recurrency: true })).toBeUndefined();
  });
  it("ponctuel + vide/invalide → undefined (omit-empty)", () => {
    expect(w("eventDate:write", "", { recurrency: false })).toBeUndefined();
    expect(w("eventDate:write", "   ", { recurrency: false })).toBeUndefined();
    expect(w("eventDate:write", "pas une date", { recurrency: false })).toBeUndefined();
  });
  it("ponctuel + ISO `.000Z` → offset local SANS millis ni Z (format accepté legacy)", () => {
    const out = w("eventDate:write", "2026-07-25T11:20:05.000Z", { recurrency: false }) as string;
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(out).not.toContain(".000");
    expect(out.endsWith("Z")).toBe(false);
  });
});

describe("eventOpeningHours:write (recurrency-aware, pad à 7)", () => {
  it("PONCTUEL → omet openingHours (undefined), même array rémanent de 2 jours", () => {
    const stale = [{ dayOfWeek: "Mo", hours: [] }, { dayOfWeek: "Tu", hours: [] }];
    expect(w("eventOpeningHours:write", stale, { recurrency: false })).toBeUndefined();
  });
  it("RÉCURRENT + 2 jours cochés → EXACTEMENT 7 entrées (jours vides → \"\")", () => {
    const out = w("eventOpeningHours:write", [
      { dayOfWeek: "Mo", hours: [{ opens: "08:00", closes: "19:00" }] },
      { dayOfWeek: "We", hours: [{ opens: "09:00", closes: "12:00" }] },
    ], { recurrency: true }) as unknown[];
    expect(out).toHaveLength(7); // minItems:7 du contrat ADD_EVENT
    expect(out[0]).toMatchObject({ dayOfWeek: "Mo" }); // lundi (index 0) présent
    expect(out[1]).toBe(""); // mardi vide → ""
    expect(out[2]).toMatchObject({ dayOfWeek: "We" }); // mercredi (index 2) présent
    expect(out[6]).toBe(""); // dimanche vide → ""
  });
  it("RÉCURRENT + aucun jour → 7 × \"\"", () => {
    const out = w("eventOpeningHours:write", [], { recurrency: true }) as unknown[];
    expect(out).toHaveLength(7);
    expect(out.every((e) => e === "")).toBe(true);
  });
});
