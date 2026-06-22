import { describe, it, expect } from "vitest";
import { getValidate } from "@/modules/formEngine";
import { addressValid, addressComplete, eventDatesValid, editEventValid, addEventValid } from "./validators"; // side-effect : enregistre les clés

const paths = (issues: Array<{ path: string }>) => issues.map((i) => i.path);

describe("validators profil (registre)", () => {
  it("addressValid : enregistré + adresse sans localityId → erreur", () => {
    expect(getValidate("addressValid")).toBe(addressValid);
    expect(addressValid({ addressCountry: "FR", localityId: "" })).toEqual([{ path: "addressLocality", message: "validation.addressLocality" }]);
    expect(addressValid({})).toEqual([]);
  });

  it("addressComplete : enregistré + exige ville + code postal + rue", () => {
    expect(getValidate("addressComplete")).toBe(addressComplete);
    const err = [{ path: "address", message: "validation.address.required" }];
    expect(addressComplete({})).toEqual(err);                                                   // rien → erreur
    expect(addressComplete({ localityId: "abc" })).toEqual(err);                                 // ville seule → incomplet
    expect(addressComplete({ localityId: "abc", postalCode: "97400" })).toEqual(err);            // sans rue → incomplet
    expect(addressComplete({ localityId: "abc", postalCode: "97400", streetAddress: "1 rue X" })).toEqual([]); // complet → OK
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

  // addEventValid (option a) : organizer requis SAUF si _hasParent — reproduit la closure d'origine.
  describe("addEventValid : organizer requis selon _hasParent (parité closure)", () => {
    const okDates = { recurrency: false, startDate: "2030-01-01", endDate: "2030-01-02" };
    it("enregistré", () => { expect(getValidate("addEventValid")).toBe(addEventValid); });
    it("sans parent + organizer {} → organizer requis (Object.keys, pas isEmpty)", () => {
      expect(paths(addEventValid({ ...okDates, _hasParent: false, organizer: {} }))).toContain("organizer");
    });
    it("AVEC parent + organizer {} → PAS d'erreur organizer", () => {
      expect(paths(addEventValid({ ...okDates, _hasParent: true, organizer: {} }))).not.toContain("organizer");
    });
    it("sans parent + organizer renseigné + dates OK + pas d'adresse → aucune erreur", () => {
      expect(addEventValid({ ...okDates, _hasParent: false, organizer: { id1: { name: "x" } } })).toEqual([]);
    });
    it("inclut la validation d'adresse (address sans localityId)", () => {
      const i = addEventValid({ ...okDates, _hasParent: true, addressCountry: "FR", localityId: "" });
      expect(i).toContainEqual({ path: "addressLocality", message: "validation.addressLocality" });
    });
  });

  describe("editEventValid : organizer requis (inconditionnel) + dates", () => {
    it("enregistré + organizer {} → requis", () => {
      expect(getValidate("editEventValid")).toBe(editEventValid);
      expect(paths(editEventValid({ recurrency: false, startDate: "a", endDate: "b", organizer: {} }))).toContain("organizer");
    });
  });
});
