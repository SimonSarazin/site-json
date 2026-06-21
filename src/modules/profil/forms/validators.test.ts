import { describe, it, expect } from "vitest";
import { getValidate } from "@/modules/formEngine";
import { addressValid, eventDatesValid } from "./validators"; // side-effect : enregistre les clés

describe("validators profil (registre)", () => {
  it("addressValid : enregistré + adresse sans localityId → erreur", () => {
    expect(getValidate("addressValid")).toBe(addressValid);
    expect(addressValid({ addressCountry: "FR", localityId: "" })).toEqual([{ path: "addressLocality", message: "validation.addressLocality" }]);
    expect(addressValid({})).toEqual([]);
  });

  it("eventDatesValid : enregistré + ponctuel sans dates → erreurs start/end", () => {
    expect(getValidate("eventDatesValid")).toBe(eventDatesValid);
    const r = eventDatesValid({ recurrency: false });
    expect(r.some((i) => i.path === "startDate")).toBe(true);
    expect(r.some((i) => i.path === "endDate")).toBe(true);
  });

  it("eventDatesValid : récurrent sans horaires → erreur openingHours", () => {
    expect(eventDatesValid({ recurrency: true, openingHours: [] }).some((i) => i.path === "openingHours")).toBe(true);
  });

  it("eventDatesValid : ponctuel endDate < startDate → erreur afterStart", () => {
    const r = eventDatesValid({ recurrency: false, startDate: "2030-01-02T10:00:00Z", endDate: "2030-01-01T10:00:00Z" });
    expect(r.some((i) => i.path === "endDate" && i.message === "validation.endDate.afterStart")).toBe(true);
  });
});
