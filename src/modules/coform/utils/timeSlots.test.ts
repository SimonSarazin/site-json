import { describe, expect, it } from "vitest";
import {
  TIME_SLOT_DAYS,
  createEmptySlot,
  dayI18nKey,
  fromTimeString,
  isSlotComplete,
  isSlotOrdered,
  isSlotPeriodOrdered,
  formatSlotDay,
  formatSlotPeriod,
  normalizeSlot,
  toTimeString,
} from "./timeSlots";

// Slot réel observé dans les answers SSBE (format de référence).
const REAL_SLOT = { day: "Monday", startHour: "08", startMinute: "00", endHour: "09", endMinute: "00" };

describe("toTimeString / fromTimeString", () => {
  it("assemble et décompose un horaire 24h (round-trip)", () => {
    expect(toTimeString("08", "00")).toBe("08:00");
    expect(fromTimeString("08:00")).toEqual({ hour: "08", minute: "00" });
  });

  it("zéro-padde les valeurs non paddées", () => {
    expect(toTimeString("8", "5")).toBe("08:05");
    expect(fromTimeString("8:5")).toEqual({ hour: "08", minute: "05" });
  });

  it("résout le format 12h legacy (AM/PM) en 24h", () => {
    expect(toTimeString("05", "00", "PM")).toBe("17:00");
    expect(toTimeString("12", "30", "PM")).toBe("12:30");
    expect(toTimeString("12", "15", "AM")).toBe("00:15");
    expect(toTimeString("09", "00", "AM")).toBe("09:00");
  });

  it("renvoie '' pour un morceau incomplet (slot en cours de saisie)", () => {
    expect(toTimeString("", "00")).toBe("");
    expect(toTimeString("08", "")).toBe("");
    expect(toTimeString("abc", "00")).toBe("");
  });
});

describe("isSlotComplete / isSlotOrdered", () => {
  it("valide le slot réel SSBE", () => {
    expect(isSlotComplete(REAL_SLOT)).toBe(true);
    expect(isSlotOrdered(REAL_SLOT)).toBe(true);
  });

  it("rejette fin <= début", () => {
    expect(isSlotOrdered({ ...REAL_SLOT, endHour: "08", endMinute: "00" })).toBe(false);
    expect(isSlotOrdered({ ...REAL_SLOT, endHour: "07", endMinute: "30" })).toBe(false);
  });

  it("compare en 24h résolu quand le slot legacy est en 12h", () => {
    // 09:00 AM → 05:00 PM = 09:00 → 17:00 : ordonné (une comparaison naïve
    // des strings "09" > "05" dirait l'inverse).
    const legacy12h = { day: "Tuesday", startHour: "09", startMinute: "00", startAmPm: "AM", endHour: "05", endMinute: "00", endAmPm: "PM" };
    expect(isSlotOrdered(legacy12h)).toBe(true);
  });

  it("un slot incomplet n'est pas 'désordonné' (il est incomplet)", () => {
    const partial = { ...REAL_SLOT, endHour: "" };
    expect(isSlotComplete(partial)).toBe(false);
    expect(isSlotOrdered(partial)).toBe(true);
  });
});

describe("normalizeSlot", () => {
  it("résout les clés AmPm legacy et ne les ré-émet jamais", () => {
    const legacy = { day: "Friday", startHour: "09", startMinute: "00", startAmPm: "AM", endHour: "05", endMinute: "00", endAmPm: "PM" };
    expect(normalizeSlot(legacy)).toEqual({ day: "Friday", startHour: "09", startMinute: "00", endHour: "17", endMinute: "00" });
  });

  it("laisse un slot 24h réel inchangé", () => {
    expect(normalizeSlot(REAL_SLOT)).toEqual(REAL_SLOT);
  });
});

describe("createEmptySlot", () => {
  it("pré-remplit depuis les heures par défaut de la config", () => {
    expect(createEmptySlot("09:00", "17:00")).toEqual({ day: "", startHour: "09", startMinute: "00", endHour: "17", endMinute: "00" });
  });

  it("reste vide sans défauts configurés", () => {
    expect(createEmptySlot()).toEqual({ day: "", startHour: "", startMinute: "", endHour: "", endMinute: "" });
  });
});

describe("référentiel jours", () => {
  it("les clés sont les valeurs EXACTES stockées en base (anglais Capitalisé)", () => {
    expect(TIME_SLOT_DAYS[0]).toBe("Monday");
    expect(TIME_SLOT_DAYS).toHaveLength(7);
  });

  it("dayI18nKey produit la clé i18n minuscule", () => {
    expect(dayI18nKey("Monday")).toBe("monday");
  });
});

describe("période propre d'un créneau", () => {
  // Traduction factice : la clé et ses paramètres.
  const t = ((key: string, _fallback?: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key) as Parameters<typeof formatSlotPeriod>[1];

  it("isSlotPeriodOrdered : seule une période complète à l'envers est désordonnée", () => {
    expect(isSlotPeriodOrdered(REAL_SLOT)).toBe(true);
    expect(isSlotPeriodOrdered({ ...REAL_SLOT, periodStart: "2026-08-24" })).toBe(true);
    expect(isSlotPeriodOrdered({ ...REAL_SLOT, periodStart: "2026-08-24", periodEnd: "2026-08-24" })).toBe(true);
    expect(isSlotPeriodOrdered({ ...REAL_SLOT, periodStart: "2026-12-14", periodEnd: "2026-08-24" })).toBe(false);
  });

  it("formatSlotDay : date courte de la locale, sans recul d'un jour ; valeur brute sinon", () => {
    expect(formatSlotDay("2026-08-19", "fr-FR")).toBe("19/08/2026");
    expect(formatSlotDay("pas une date", "fr-FR")).toBe("pas une date");
  });

  it("formatSlotPeriod : deux bornes, une seule, ou rien à dire", () => {
    expect(formatSlotPeriod({ ...REAL_SLOT, periodStart: "2026-08-19", periodEnd: "2026-10-10" }, t, "fr-FR")).toBe(
      'coform.timeSlots.period {"start":"19/08/2026","end":"10/10/2026"}',
    );
    expect(formatSlotPeriod({ ...REAL_SLOT, periodStart: "2026-08-19" }, t, "fr-FR")).toBe(
      'coform.timeSlots.periodFrom {"start":"19/08/2026"}',
    );
    expect(formatSlotPeriod({ ...REAL_SLOT, periodEnd: "2026-10-10" }, t, "fr-FR")).toBe(
      'coform.timeSlots.periodUntil {"end":"10/10/2026"}',
    );
    expect(formatSlotPeriod(REAL_SLOT, t, "fr-FR")).toBeNull();
  });

  it("normalizeSlot conserve la période à l'édition", () => {
    const date = { ...REAL_SLOT, periodStart: "2026-08-24", periodEnd: "2026-12-14" };
    expect(normalizeSlot(date)).toMatchObject({ periodStart: "2026-08-24", periodEnd: "2026-12-14" });
  });
});
