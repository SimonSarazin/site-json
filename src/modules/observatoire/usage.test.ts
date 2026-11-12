import { describe, it, expect } from "vitest";
import type { Reservation, ReservationSlot } from "@/modules/search/lib/reservations";
import {
  audienceOf, bandLabel, computePoiUsage, usageDimensionIds, usageFields, usagerIdsOf, withUsage,
  type PoiUsage, type UsageConf, type UsageLabels,
} from "./usage";
import { uniqSorted } from "./utils";

const conf: UsageConf = {
  referenceAmplitude: { startHour: 8, endHour: 22, days: 7 },
  schoolUserTypes: ["Etablissement scolaire", "Association sportive scolaire"],
  schoolOrgTypes: ["GovernmentOrganization"],
  bands: { rate: [0, 25, 50, 75], clubHours: [0, 5, 15] },
};
const PLAGE = 14 * 60 * 7;
const TODAY = "2026-10-28";

const slot = (start: number, end: number, day: ReservationSlot["day"] = "monday"): ReservationSlot => ({
  day, start: `${start}:00`, end: `${end}:00`, startMinutes: start * 60, endMinutes: end * 60,
});
const resa = (poi: string, slots: ReservationSlot[], extra: Partial<Reservation> = {}): Reservation => ({
  id: `${poi}-${slots.length}-${extra.userType ?? extra.userId ?? "x"}`,
  resources: [{ id: poi }],
  resourceIds: [poi],
  user: "",
  periodStart: "2026-08-17",
  periodEnd: "2027-07-02",
  slots,
  ...extra,
});
const NO_TYPES = new Map<string, string>();

const labels: UsageLabels = {
  status: { open: "Ouvert", closed: "Non ouvert", noPlanning: "Sans planning" },
  band: {
    zero: (unit) => `0 ${unit}`,
    range: (min, max, unit) => `${min}–${max} ${unit}`,
    over: (min, unit) => `plus de ${min} ${unit}`,
  },
};

describe("audienceOf — école, club ou non précisé", () => {
  it("le type d'usager importé décide : scolaire seulement si TOUTES ses valeurs le sont", () => {
    expect(audienceOf(resa("p", [], { userType: "Etablissement scolaire" }), NO_TYPES, conf)).toBe("school");
    expect(audienceOf(resa("p", [], { userType: "Association sportive scolaire | Etablissement scolaire" }), NO_TYPES, conf)).toBe("school");
    expect(audienceOf(resa("p", [], { userType: "Etablissement scolaire | Association" }), NO_TYPES, conf)).toBe("club");
  });

  it("sans type d'usager, la fiche de l'usager décide ; ni l'un ni l'autre : non précisé", () => {
    const types = new Map([["lycee", "GovernmentOrganization"], ["club", "NGO"]]);
    expect(audienceOf(resa("p", [], { userId: "lycee" }), types, conf)).toBe("school");
    expect(audienceOf(resa("p", [], { userId: "club" }), types, conf)).toBe("club");
    expect(audienceOf(resa("p", [], { userId: "inconnu" }), types, conf)).toBe("unknown");
    expect(audienceOf(resa("p", []), types, conf)).toBe("unknown");
  });

  it("le type d'usager importé prime sur la fiche (l'AS a une fiche d'association)", () => {
    const types = new Map([["as", "NGO"]]);
    expect(audienceOf(resa("p", [], { userId: "as", userType: "Association sportive scolaire" }), types, conf)).toBe("school");
  });
});

describe("computePoiUsage — statut, heures et taux par équipement", () => {
  const reservations = [
    resa("a", [slot(8, 10)], { userType: "Etablissement scolaire" }),
    resa("a", [slot(18, 20)], { userType: "Association sportive" }),
    resa("b", [slot(8, 12)], { userType: "Etablissement scolaire" }),
    resa("d", [slot(18, 20)], { userType: "Association", periodStart: "2025-08-18", periodEnd: "2026-07-03" }),
    resa("e", [slot(9, 10)]),
  ];
  const usage = computePoiUsage(reservations, ["a", "b", "c", "d", "e"], TODAY, NO_TYPES, conf);

  it("ouvert avec un créneau de club : heures par public, libre et taux sur la plage", () => {
    expect(usage.get("a")).toEqual({
      status: "open", occupiedMinutes: 240, schoolMinutes: 120, clubMinutes: 120, unknownMinutes: 0,
      freeMinutes: PLAGE - 240, rate: 240 / PLAGE,
    });
  });

  it("non ouvert avec des créneaux seulement scolaires — ou non précisés", () => {
    expect(usage.get("b")?.status).toBe("closed");
    expect(usage.get("e")?.status).toBe("closed");
    expect(usage.get("e")?.unknownMinutes).toBe(60);
  });

  it("sans planning : aucun créneau, ou seulement une saison terminée — toute la plage est libre", () => {
    for (const id of ["c", "d"]) {
      expect(usage.get(id)).toMatchObject({ status: "noPlanning", occupiedMinutes: 0, freeMinutes: PLAGE, rate: 0 });
    }
  });
});

describe("bandLabel — tranches des filtres", () => {
  it("≤ premier seuil, puis ]s(i-1), s(i)], puis au-delà du dernier", () => {
    const b = (v: number) => bandLabel(v, [0, 25, 50, 75], "%", labels.band);
    expect([0, 10, 25, 30, 75, 90].map(b)).toEqual(["0 %", "0–25 %", "0–25 %", "25–50 %", "50–75 %", "plus de 75 %"]);
    expect(bandLabel(3, [5, 15], "h", labels.band)).toBe("0–5 h");
  });

  it("l'ordre alphabétique des options (uniqSorted) est l'ordre des valeurs", () => {
    const taux = ["0 %", "0–25 %", "25–50 %", "50–75 %", "plus de 75 %"];
    const heures = ["0 h", "0–5 h", "5–15 h", "plus de 15 h"];
    expect(uniqSorted([...taux].reverse())).toEqual(taux);
    expect(uniqSorted([...heures].reverse())).toEqual(heures);
  });
});

describe("usageFields / withUsage — champs __usage des items", () => {
  it("heures au dixième, taux en % entier, tranches selon conf.bands", () => {
    const ouvert: PoiUsage = {
      status: "open", occupiedMinutes: 90, schoolMinutes: 0, clubMinutes: 90, unknownMinutes: 0, freeMinutes: PLAGE - 90, rate: 90 / PLAGE,
    };
    expect(usageFields(ouvert, conf, labels)).toEqual({
      status: "Ouvert", open: true, openCount: 1, occupiedHours: 1.5, schoolHours: 0, clubHours: 1.5, unknownHours: 0,
      freeHours: 96.5, rate: 2, rateBand: "0–25 %", clubHoursBand: "0–5 h",
    });
    const sansTranches = usageFields(ouvert, { ...conf, bands: undefined }, labels);
    expect(sansTranches).not.toHaveProperty("rateBand");
    expect(sansTranches).not.toHaveProperty("clubHoursBand");
  });

  it("sans planning : ni heures libres, ni taux, ni tranche de taux (rien à mesurer) ; la tranche d'heures clubs reste", () => {
    // Ses 98 h « disponibles » et son 0 % gonflaient les heures libres et écrasaient le taux moyen du parc
    // (review de la MR 120).
    expect(usageFields(computePoiUsage([], ["x"], TODAY, NO_TYPES, conf).get("x")!, conf, labels)).toEqual({
      status: "Sans planning", open: false, openCount: 0, occupiedHours: 0, schoolHours: 0, clubHours: 0, unknownHours: 0,
      clubHoursBand: "0 h",
    });
  });

  it("pose __usage par identifiant, laisse tel quel un item sans mesure", () => {
    const usage = computePoiUsage([], ["a"], TODAY, NO_TYPES, conf);
    const [avec, sans] = withUsage([{ name: "A" }, { name: "B" }], ["a", "z"], usage, conf, labels);
    expect(avec.__usage?.status).toBe("Sans planning");
    expect(sans).toEqual({ name: "B" });
  });
});

describe("usagerIdsOf / usageDimensionIds — câblage de la section", () => {
  const ORGA = "6a0b3078f16441794857e2a1";

  it("organisations usagères sans doublon, réponses sans fiche ignorées", () => {
    expect(usagerIdsOf([resa("a", [], { userId: ORGA }), resa("b", [], { userId: ORGA }), resa("c", [])])).toEqual([ORGA]);
    expect(usagerIdsOf(undefined)).toEqual([]);
  });

  it("une clé d'usager qui n'est pas un identifiant de base est écartée (elle ferait échouer toute la requête)", () => {
    expect(usagerIdsOf([resa("a", [], { userId: ORGA }), resa("b", [], { userId: "club-saisi-a-la-main" })])).toEqual([ORGA]);
  });

  it("seules les dimensions qui lisent un chemin __usage.* attendent la mesure", () => {
    const ids = usageDimensionIds({
      statut: { paths: ["__usage.status"] },
      taux: { paths: ["__usage.rate"], kind: "number" },
      commune: { paths: ["address.postalCode"] },
    });
    expect([...ids].sort()).toEqual(["statut", "taux"]);
  });
});
