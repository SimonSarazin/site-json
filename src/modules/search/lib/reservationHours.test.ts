import { describe, it, expect } from "vitest";
import type { Reservation, ReservationSlot } from "./reservations";
import {
  countWeekdays,
  formatReservationHours,
  hoursOf,
  sumReservationHours,
  weeklyReferenceDay,
  weeklyReservations,
} from "./reservationHours";

const A = "6a0b3078f16441794857e2f0";
const B = "6a0b3078f16441794857e2f1";

// Un mardi : « en cours ou à venir » se lit à partir de ce jour.
const today = "2026-10-20";

const slot = (day: ReservationSlot["day"], start: string, end: string): ReservationSlot => {
  const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  return { day, start, end, startMinutes: minutes(start), endMinutes: minutes(end) };
};

const reservation = (
  resourceIds: string[],
  slots: ReservationSlot[],
  periodStart?: string,
  periodEnd?: string,
): Reservation => ({
  id: "r",
  resources: resourceIds.map((r) => ({ id: r })),
  resourceIds,
  user: "Club",
  slots,
  periodStart,
  periodEnd,
});

describe("countWeekdays", () => {
  it("compte les occurrences réelles d'un jour, bornes incluses", () => {
    // 2026-10-19 est un lundi.
    expect(countWeekdays("2026-10-19", "2026-10-19", "monday")).toBe(1);
    expect(countWeekdays("2026-10-19", "2026-10-19", "tuesday")).toBe(0);
    expect(countWeekdays("2026-10-19", "2026-10-26", "monday")).toBe(2);
    expect(countWeekdays("2026-10-20", "2026-10-26", "monday")).toBe(1);
    expect(countWeekdays("2026-10-20", "2026-10-25", "monday")).toBe(0);
  });

  it("couvre une saison complète et refuse une période inversée", () => {
    // Saison 2026-2027 en base : 52 jeudis entre le 15/08/2026 et le 14/08/2027.
    expect(countWeekdays("2026-08-15", "2027-08-14", "thursday")).toBe(52);
    expect(countWeekdays("2026-10-26", "2026-10-19", "monday")).toBe(0);
  });
});

describe("hoursOf", () => {
  it("hebdomadaire = somme des créneaux ; cumulé = chaque créneau × ses occurrences dans la période", () => {
    // Du lundi 19 au lundi 26/10 : 2 lundis (2 h) et 1 jeudi (1 h 30).
    const r = reservation([A], [slot("monday", "17:00", "19:00"), slot("thursday", "18:00", "19:30")], "2026-10-19", "2026-10-26");
    expect(hoursOf(r)).toEqual({ weeklyMinutes: 210, cumulativeMinutes: 2 * 120 + 90 });
  });

  it("sans période exploitable, le cumul vaut 0 ; une durée dégradée ne compte pas", () => {
    expect(hoursOf(reservation([A], [slot("monday", "17:00", "19:00")], "2026-10-19"))).toEqual({
      weeklyMinutes: 120,
      cumulativeMinutes: 0,
    });
    expect(hoursOf(reservation([A], [slot("monday", "19:00", "17:00")], "2026-10-19", "2026-10-26"))).toEqual({
      weeklyMinutes: 0,
      cumulativeMinutes: 0,
    });
  });

  it("lit une borne datée-heurée sur ses 10 premiers caractères", () => {
    const r = reservation([A], [slot("monday", "17:00", "18:00")], "2026-10-19T00:00:00", "2026-10-26T00:00:00");
    expect(hoursOf(r).cumulativeMinutes).toBe(120);
  });
});

describe("sumReservationHours", () => {
  const terminee = reservation([A], [slot("monday", "17:00", "19:00")], "2026-01-01", "2026-08-14");
  const enCours = reservation([A], [slot("monday", "17:00", "19:00")], "2026-10-19", "2026-10-26");
  const aVenir = reservation([B], [slot("tuesday", "08:00", "09:00")], "2027-01-05", "2027-01-05");
  const finAujourdhui = reservation([B], [slot("tuesday", "10:00", "11:00")], "2026-10-13", today);

  it("ne compte que les réservations en cours ou à venir ; l'hebdomadaire, celles actives aujourd'hui", () => {
    // `aVenir` (janvier 2027) entre dans le cumul, pas dans la semaine en cours.
    expect(sumReservationHours([terminee, enCours, aVenir, finAujourdhui], today)).toEqual({
      weeklyMinutes: 120 + 60,
      cumulativeMinutes: 2 * 120 + 60 + 2 * 60,
    });
  });

  it("restreint aux équipements du lot, une fois par équipement pointé", () => {
    const deux = reservation([A, B], [slot("monday", "17:00", "18:00")], "2026-10-26", "2026-10-26");
    // `deux` ne commence que le 26/10 : la semaine de référence (en cours) ne la compte pas.
    expect(sumReservationHours([enCours, aVenir, deux], today, new Set([A]))).toEqual({
      weeklyMinutes: 120,
      cumulativeMinutes: 2 * 120 + 60,
    });
    expect(sumReservationHours([deux], today, new Set([A, B]))).toEqual({ weeklyMinutes: 120, cumulativeMinutes: 120 });
    expect(sumReservationHours([enCours], today, new Set())).toEqual({ weeklyMinutes: 0, cumulativeMinutes: 0 });
  });
});

describe("période propre d'un créneau", () => {
  // Réservation de saison dont un créneau n'occupe qu'un cycle : celui du lundi s'arrête le 2026-10-19
  // (un lundi), celui du jeudi court toute la saison.
  const saison = reservation(
    [A],
    [
      { ...slot("monday", "17:00", "19:00"), periodEnd: "2026-10-19" },
      slot("thursday", "08:00", "09:00"),
    ],
    "2026-10-05",
    "2026-10-29",
  );

  it("hoursOf : le cumul de chaque créneau se compte sur SA période", () => {
    // Lundis du 05/10 au 19/10 : 3 × 120 ; jeudis du 05/10 au 29/10 : 4 × 60.
    expect(hoursOf(saison)).toEqual({ weeklyMinutes: 180, cumulativeMinutes: 3 * 120 + 4 * 60 });
  });

  it("sumReservationHours : le cycle terminé ne compte plus, le reste de la saison si", () => {
    expect(sumReservationHours([saison], today)).toEqual({ weeklyMinutes: 60, cumulativeMinutes: 4 * 60 });
  });
});

describe("semaine de référence (une réservation par période)", () => {
  // Import « option B » : le même créneau, une réservation par trimestre. Le 20/10 tombe dans le 1er.
  const lundi = () => slot("monday", "09:30", "11:20");
  const t1 = reservation([A], [lundi()], "2026-08-19", "2026-11-05");
  const t2 = reservation([A], [lundi()], "2026-11-09", "2027-02-18");
  const t3 = reservation([A], [lundi()], "2027-02-22", "2027-06-30");

  it("weeklyReferenceDay : le jour même si un créneau y est actif", () => {
    expect(weeklyReferenceDay([t1, t2, t3], today)).toBe(today);
  });

  it("weeklyReferenceDay : sinon le premier début à venir — entre deux trimestres, le suivant", () => {
    expect(weeklyReferenceDay([t1, t2, t3], "2026-11-06")).toBe("2026-11-09");
    expect(weeklyReferenceDay([t3, t2], "2026-11-06")).toBe("2026-11-09");
  });

  it("weeklyReferenceDay : le jour donné quand rien n'est actif ni à venir, ou qu'aucun créneau n'occupe de temps", () => {
    expect(weeklyReferenceDay([t1], "2027-01-04")).toBe("2027-01-04");
    expect(weeklyReferenceDay([], today)).toBe(today);
    const degrade = reservation([A], [slot("monday", "11:00", "09:00")], "2026-08-19", "2026-11-05");
    expect(weeklyReferenceDay([degrade, t2], today)).toBe("2026-11-09");
  });

  it("l'hebdomadaire ne compte qu'un trimestre, le cumul les compte tous", () => {
    const { weeklyMinutes, cumulativeMinutes } = sumReservationHours([t1, t2, t3], today);
    expect(weeklyMinutes).toBe(110);
    expect(cumulativeMinutes).toBe(
      110 * (countWeekdays("2026-08-19", "2026-11-05", "monday")
        + countWeekdays("2026-11-09", "2027-02-18", "monday")
        + countWeekdays("2027-02-22", "2027-06-30", "monday")),
    );
  });

  it("une référence imposée vaut pour chaque ligne : le total reste la somme des lignes", () => {
    // Club B : seulement au 2e trimestre. Référence = aujourd'hui (club A actif) → 0 h/sem pour B.
    const b = reservation([A], [slot("tuesday", "08:00", "09:00")], "2026-11-09", "2027-02-18");
    const reference = weeklyReferenceDay([t1, b], today);
    expect(sumReservationHours([b], today, undefined, reference).weeklyMinutes).toBe(0);
    // Seul, B prendrait SA prochaine semaine réservée.
    expect(sumReservationHours([b], today).weeklyMinutes).toBe(60);
  });

  it("hoursOf : sans référence imposée, celle de la réservation seule", () => {
    expect(hoursOf(t2, today).weeklyMinutes).toBe(110);
    expect(hoursOf(t2, today, today).weeklyMinutes).toBe(0);
  });

  it("weeklyReservations : les seuls créneaux actifs le jour de référence", () => {
    expect(weeklyReservations([t1, t2, t3], today)).toEqual([t1]);
    expect(weeklyReservations([t1, t2, t3], "2026-11-06")).toEqual([t2]);
  });
});

describe("formatReservationHours", () => {
  const t = ((key: string, _: unknown, vars: Record<string, string>) =>
    `${key}:${vars.weekly}|${vars.cumulative}`) as unknown as Parameters<typeof formatReservationHours>[1];

  it("arrondit au dixième d'heure, format français, et choisit la phrase de total", () => {
    expect(formatReservationHours({ weeklyMinutes: 270, cumulativeMinutes: 8100 }, t)).toBe("ReservationHours.summary:4,5|135");
    expect(formatReservationHours({ weeklyMinutes: 60, cumulativeMinutes: 0 }, t, true)).toBe("ReservationHours.total:1|0");
  });
});
