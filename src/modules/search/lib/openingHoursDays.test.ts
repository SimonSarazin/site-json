import { describe, it, expect } from "vitest";
import { formatRecurrenceLabel, recurringDayKeys } from "./openingHoursDays";

describe("recurringDayKeys", () => {
  it("un seul jour avec créneau", () => {
    expect(recurringDayKeys([{ dayOfWeek: "Fr", hours: [{ opens: "08:00", closes: "19:00" }] }])).toEqual(["friday"]);
  });

  it("plusieurs jours, réordonnés Lundi→Dimanche indépendamment de l'ordre d'entrée", () => {
    const openingHours = [
      { dayOfWeek: "Fr", hours: [{ opens: "08:00", closes: "19:00" }] },
      { dayOfWeek: "We", hours: [{ opens: "08:00", closes: "19:00" }] },
    ];
    expect(recurringDayKeys(openingHours)).toEqual(["wednesday", "friday"]);
  });

  it("forme réelle backend : entrées vides ('') mêlées aux jours actifs, ignorées", () => {
    const openingHours = ["", "", { dayOfWeek: "We", hours: [{ opens: "08:00", closes: "19:00" }] }, "", "", "", ""];
    expect(recurringDayKeys(openingHours)).toEqual(["wednesday"]);
  });

  it("jour sans créneau (hours vide) → ignoré", () => {
    expect(recurringDayKeys([{ dayOfWeek: "Mo", hours: [] }])).toEqual([]);
  });

  it("pas un tableau → []", () => {
    expect(recurringDayKeys(undefined)).toEqual([]);
    expect(recurringDayKeys(null)).toEqual([]);
  });
});

/** `t` factice fr, fidèle aux clés réelles (`modules/search/i18n/fr.json`) — pour tester le libellé produit. */
const FR_DICT: Record<string, string> = {
  "days.monday": "Lundi",
  "days.tuesday": "Mardi",
  "days.wednesday": "Mercredi",
  "days.thursday": "Jeudi",
  "days.friday": "Vendredi",
  "days.saturday": "Samedi",
  "days.sunday": "Dimanche",
  "card.event.recurringAnd": "et",
};
const t = (key: string, _fallback?: string, params?: Record<string, unknown>) =>
  key === "card.event.recurring" ? `Chaque ${params?.days ?? ""}` : (FR_DICT[key] ?? key);

describe("formatRecurrenceLabel", () => {
  it("non récurrent → null", () => {
    expect(formatRecurrenceLabel(false, [{ dayOfWeek: "Fr", hours: [{ opens: "08:00", closes: "19:00" }] }], t)).toBeNull();
    expect(formatRecurrenceLabel(undefined, [{ dayOfWeek: "Fr", hours: [{ opens: "08:00", closes: "19:00" }] }], t)).toBeNull();
  });

  it("récurrent sans jour exploitable → null", () => {
    expect(formatRecurrenceLabel(true, [], t)).toBeNull();
  });

  it("un jour : « Chaque vendredi »", () => {
    expect(formatRecurrenceLabel(true, [{ dayOfWeek: "Fr", hours: [{ opens: "08:00", closes: "19:00" }] }], t)).toBe(
      "Chaque vendredi",
    );
  });

  it("deux jours : « Chaque mercredi et vendredi » (jours en minuscule, ordre Lundi→Dimanche)", () => {
    const openingHours = [
      { dayOfWeek: "Fr", hours: [{ opens: "08:00", closes: "19:00" }] },
      { dayOfWeek: "We", hours: [{ opens: "08:00", closes: "19:00" }] },
    ];
    expect(formatRecurrenceLabel(true, openingHours, t)).toBe("Chaque mercredi et vendredi");
  });

  it("trois jours : virgules + « et » avant le dernier", () => {
    const openingHours = [
      { dayOfWeek: "Mo", hours: [{ opens: "08:00", closes: "19:00" }] },
      { dayOfWeek: "We", hours: [{ opens: "08:00", closes: "19:00" }] },
      { dayOfWeek: "Fr", hours: [{ opens: "08:00", closes: "19:00" }] },
    ];
    expect(formatRecurrenceLabel(true, openingHours, t)).toBe("Chaque lundi, mercredi et vendredi");
  });
});
