import { describe, it, expect, vi, afterEach } from "vitest";
import { fr } from "date-fns/locale";
import type { useT } from "@/hooks/useT";

// Locale figée : `getDateFnsLocale` suit la langue d'i18n, que ce test n'initialise pas.
vi.mock("@/dateFns", () => ({ default: () => fr }));

import {
  formatIsoDate,
  formatIsoDateShort,
  formatPeriodShort,
  formatReservationPeriod,
  slotHoursContext,
} from "./reservationPeriod";

/** `t` de test : la clé et ses paramètres — on vérifie QUELLE phrase est choisie, pas sa traduction. */
const t = ((key: string, _fallback?: string, params?: Record<string, unknown>) =>
  `${key} ${JSON.stringify(params)}`) as unknown as ReturnType<typeof useT>;

const TZ_INITIAL = process.env.TZ;
afterEach(() => {
  if (TZ_INITIAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_INITIAL;
});

describe("formatIsoDate", () => {
  it("date ISO → jour, mois abrégé et année dans la locale", () => {
    expect(formatIsoDate("2026-09-01")).toBe("1 sept. 2026");
  });

  it("date seule lue à minuit LOCAL : pas de recul d'un jour sous un fuseau UTC négatif", () => {
    process.env.TZ = "America/Guadeloupe";
    // Le piège est bien actif sous ce fuseau : `new Date` lit une date seule en UTC (31 déc. au soir).
    expect(new Date("2026-01-01").getDate()).toBe(31);
    expect(formatIsoDate("2026-01-01")).toBe("1 janv. 2026");
  });

  it("valeur illisible → la valeur brute plutôt qu'une date fausse", () => {
    expect(formatIsoDate("bientôt")).toBe("bientôt");
  });
});

describe("formatReservationPeriod", () => {
  it("deux bornes → « Du … au … »", () => {
    expect(formatReservationPeriod({ periodStart: "2026-09-01", periodEnd: "2027-06-30" }, t))
      .toBe('PreviewReservations.period {"start":"1 sept. 2026","end":"30 juin 2027"}');
  });

  it("début seul → « À partir du … »", () => {
    expect(formatReservationPeriod({ periodStart: "2026-09-01" }, t))
      .toBe('PreviewReservations.periodFrom {"start":"1 sept. 2026"}');
  });

  it("fin seule → « Jusqu'au … »", () => {
    expect(formatReservationPeriod({ periodEnd: "2027-06-30" }, t))
      .toBe('PreviewReservations.periodUntil {"end":"30 juin 2027"}');
  });
});

describe("slotHoursContext", () => {
  const lundi = { day: "monday" as const, start: "07:35", end: "15:10", startMinutes: 455, endMinutes: 910 };

  it("usager, jour et période EFFECTIVE du créneau", () => {
    const reservation = { user: "Lycée", periodStart: "2026-08-18", periodEnd: "2027-07-02" };
    expect(slotHoursContext(reservation, lundi, t)).toBe(
      'Lycée · days.monday undefined · PreviewReservations.period {"start":"18 août 2026","end":"2 juil. 2027"}',
    );
    expect(slotHoursContext(reservation, { ...lundi, periodEnd: "2026-11-03" }, t)).toContain('"end":"3 nov. 2026"');
  });

  it("sans période ni usager : le jour seul, après le libellé de repli", () => {
    expect(slotHoursContext({ user: "" }, lundi, t)).toBe(
      "PreviewReservations.unknownUser undefined · days.monday undefined",
    );
  });
});

describe("formatIsoDateShort", () => {
  it("date ISO → date courte de la locale, sans recul d'un jour sous un fuseau UTC négatif", () => {
    expect(formatIsoDateShort("2026-08-19")).toBe("19/08/2026");
    process.env.TZ = "America/Guadeloupe";
    expect(formatIsoDateShort("2026-01-01")).toBe("01/01/2026");
  });

  it("valeur illisible → la valeur brute", () => {
    expect(formatIsoDateShort("bientôt")).toBe("bientôt");
  });
});

describe("formatPeriodShort", () => {
  it("deux bornes → la flèche entre deux dates courtes", () => {
    expect(formatPeriodShort({ periodStart: "2026-08-19", periodEnd: "2026-11-05" }, t))
      .toBe('PreviewReservations.periodShort {"start":"19/08/2026","end":"05/11/2026"}');
  });

  it("une seule borne → la phrase de la borne, en date courte ; aucune → rien", () => {
    expect(formatPeriodShort({ periodStart: "2026-08-19" }, t))
      .toBe('PreviewReservations.periodFrom {"start":"19/08/2026"}');
    expect(formatPeriodShort({ periodEnd: "2026-11-05" }, t))
      .toBe('PreviewReservations.periodUntil {"end":"05/11/2026"}');
    expect(formatPeriodShort({}, t)).toBe("");
  });
});
