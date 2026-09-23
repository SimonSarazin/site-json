import { describe, it, expect } from "vitest";
import { fr } from "date-fns/locale";
import { libellesDate, porteeDate } from "./eventDateSpan";

const d = (s: string) => new Date(s);

describe("porteeDate", () => {
  it("sans début ou sans fin : un jour", () => {
    expect(porteeDate(null, d("2026-10-31T21:30"))).toEqual({ kind: "jour" });
    expect(porteeDate(d("2026-10-01T08:30"), null)).toEqual({ kind: "jour" });
  });

  it("fin le soir même : un jour, pas une plage", () => {
    expect(porteeDate(d("2026-10-01T08:30"), d("2026-10-01T21:30"))).toEqual({ kind: "jour" });
  });

  it("créneau de nuit qui franchit minuit : reste un jour — `closingTimeOnDay` reporte la fin au lendemain exprès", () => {
    // 21:00 → 01:00 : la fin tombe le lendemain, 4 h plus tard.
    expect(porteeDate(d("2026-09-16T21:00"), d("2026-09-17T01:00"))).toEqual({ kind: "jour" });
  });

  it("24 h ou plus sur deux jours : une plage", () => {
    expect(porteeDate(d("2026-10-01T20:00"), d("2026-10-02T20:00")).kind).toBe("plage");
  });

  it("plage dans le même mois : « Mois de la parentalité », 1 → 31 octobre — bornes portées", () => {
    const debut = d("2026-10-01T08:30"), fin = d("2026-10-31T21:30");
    expect(porteeDate(debut, fin)).toEqual({ kind: "plage", debut, fin, memeMois: true, memeAnnee: true });
  });

  it("plage à cheval sur deux mois de la même année", () => {
    expect(porteeDate(d("2026-09-28T09:00"), d("2026-10-03T18:00"))).toMatchObject({
      kind: "plage", memeMois: false, memeAnnee: true,
    });
  });

  it("plage à cheval sur deux années", () => {
    expect(porteeDate(d("2026-12-30T09:00"), d("2027-01-02T18:00"))).toMatchObject({
      kind: "plage", memeMois: false, memeAnnee: false,
    });
  });

  it("fin ANTÉRIEURE au début (donnée incohérente) : traitée comme absente", () => {
    expect(porteeDate(d("2026-10-10T09:00"), d("2026-10-02T09:00"))).toEqual({ kind: "jour" });
  });
});

describe("libellesDate (fr)", () => {
  it("un jour : le jour, puis mois et année", () => {
    expect(libellesDate(d("2026-10-01T08:30"), d("2026-10-01T21:30"), fr)).toEqual({ grand: "1", petit: "oct. 2026" });
    expect(libellesDate(d("2026-10-01T08:30"), null, fr)).toEqual({ grand: "1", petit: "oct. 2026" });
  });

  it("créneau de nuit : un seul jour, pas « 16 – 17 »", () => {
    expect(libellesDate(d("2026-09-16T21:00"), d("2026-09-17T01:00"), fr)).toEqual({ grand: "16", petit: "sept. 2026" });
  });

  it("même mois : la borne de gauche tait mois et année", () => {
    expect(libellesDate(d("2026-10-01T08:30"), d("2026-10-31T21:30"), fr)).toEqual({ grand: "1 – 31", petit: "oct. 2026" });
  });

  it("deux mois : la gauche garde son mois ; deux années : la gauche garde tout", () => {
    expect(libellesDate(d("2026-09-28T09:00"), d("2026-10-03T18:00"), fr)).toEqual({ grand: "28 sept. – 3", petit: "oct. 2026" });
    expect(libellesDate(d("2026-12-30T09:00"), d("2027-01-02T18:00"), fr)).toEqual({ grand: "30 déc. 2026 – 2", petit: "janv. 2027" });
  });
});
