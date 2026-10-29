import { describe, it, expect } from "vitest";
import type { UsageConf } from "@/modules/observatoire/usage";
import type { Reservation } from "./reservations";
import { EXCLUDE_TYPE, INCLUDE_TYPE } from "./searchByFieldsToQuery";
import { statusFromParam, usageFilterClause } from "./usageFilter";

const conf: UsageConf = {
  referenceAmplitude: { startHour: 8, endHour: 22, days: 7 },
  schoolUserTypes: ["Etablissement scolaire"],
};
const TODAY = "2026-10-28";
const OUVERT = "6a0b3078f16441794857e2f0";
const SCOLAIRE = "6a0b22f05e566670c41bcf04";
const TERMINE = "6a0b33c6e0a16e06970057fe";
const resa = (poi: string, userType: string, periodEnd = "2027-07-02"): Reservation => ({
  id: `${poi}-${userType}`,
  resources: [{ id: poi }],
  resourceIds: [poi],
  user: "",
  userType,
  periodStart: "2026-08-17",
  periodEnd,
  slots: [{ day: "monday", start: "18:00", end: "20:00", startMinutes: 1080, endMinutes: 1200 }],
});
const reservations = [
  resa(OUVERT, "Association sportive"),
  resa(SCOLAIRE, "Etablissement scolaire"),
  resa(TERMINE, "Association", "2026-07-03"),
  resa("demo-1", "Association"),
];

describe("statusFromParam", () => {
  it("statut connu, sinon null (lien abîmé)", () => {
    expect(statusFromParam("open")).toBe("open");
    expect(statusFromParam("noPlanning")).toBe("noPlanning");
    expect(statusFromParam("ouvert")).toBeNull();
    expect(statusFromParam(null)).toBeNull();
  });
});

describe("usageFilterClause — statut choisi → entrée calculée sur _id", () => {
  it("ouvert / non ouvert : $in des équipements de ce statut (identifiants de base seulement)", () => {
    expect(usageFilterClause(reservations, "open", TODAY, new Map(), conf)).toEqual({ type: INCLUDE_TYPE, ids: [OUVERT] });
    expect(usageFilterClause(reservations, "closed", TODAY, new Map(), conf)).toEqual({ type: INCLUDE_TYPE, ids: [SCOLAIRE] });
  });

  it("sans planning : $nin des équipements qui ont un créneau en cours ou à venir (saison terminée = sans planning)", () => {
    expect(usageFilterClause(reservations, "noPlanning", TODAY, new Map(), conf)).toEqual({
      type: EXCLUDE_TYPE,
      ids: [SCOLAIRE, OUVERT].sort(),
    });
  });

  it("aucun équipement du statut : liste vide (le traducteur la rend par « aucun résultat »)", () => {
    expect(usageFilterClause([resa(SCOLAIRE, "Etablissement scolaire")], "open", TODAY, new Map(), conf).ids).toEqual([]);
  });
});
