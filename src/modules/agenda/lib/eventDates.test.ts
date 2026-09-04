import { describe, it, expect } from "vitest";
import type { Event } from "@communecter/cocolight-api-client";
import { DAYS, type DayOfWeek } from "@/constants/DAYS";
import { eventOccurrence } from "./eventDates";

const ev = (serverData: Record<string, unknown>) => ({ serverData }) as unknown as Event;
/** `Date.getDay()` (0=dimanche) → code `DAYS` — même mapping que `eventDates.ts`, recalculé ici pour
 *  ne pas dépendre du jour de semaine réel d'une date en dur. */
const dayCodeOf = (d: Date): DayOfWeek => DAYS[(d.getDay() + 6) % 7];

describe("eventOccurrence", () => {
  it("ponctuel : startDate (Date, normalisé par le SDK)", () => {
    const { start } = eventOccurrence(ev({ startDate: new Date("2026-08-14T09:00:00Z") }));
    expect(start?.toISOString()).toBe("2026-08-14T09:00:00.000Z");
  });

  it("récurrent : startDateSort en objet PHP brut (forme réelle backend) → ignoré, repli sur startDateSortFormat", () => {
    const { start } = eventOccurrence(
      ev({
        startDateSort: { date: "2026-08-14 09:00:00.000000", timezone_type: 3, timezone: "Europe/Paris" },
        startDateSortFormat: "2026-08-14T09:00:00+0200",
      }),
    );
    expect(start?.toISOString()).toBe("2026-08-14T07:00:00.000Z");
  });

  it("récurrent : startDateSort déjà en string ISO (forme défensive) → utilisé directement", () => {
    const { start } = eventOccurrence(ev({ startDateSort: "2026-08-14T09:00:00Z" }));
    expect(start?.toISOString()).toBe("2026-08-14T09:00:00.000Z");
  });

  it("aucune date exploitable → start null", () => {
    const { start } = eventOccurrence(ev({ startDateSort: { date: "2026-08-14 09:00:00.000000" } }));
    expect(start).toBeNull();
  });

  it("endDate présent (event multi-jours)", () => {
    const { end } = eventOccurrence(ev({ startDate: new Date("2026-08-14"), endDate: new Date("2026-08-16") }));
    expect(end?.toISOString()).toBe(new Date("2026-08-16").toISOString());
  });

  it("récurrent sans endDate : end dérivé de l'heure de fin (openingHours) du jour de start", () => {
    const start = new Date("2026-08-14T09:00:00"); // vendredi
    const { end } = eventOccurrence(
      ev({
        startDateSortFormat: start.toISOString(),
        openingHours: [{ dayOfWeek: dayCodeOf(start), hours: [{ opens: "08:00", closes: "19:00" }] }],
      }),
    );
    expect(end?.getHours()).toBe(19);
    expect(end?.getMinutes()).toBe(0);
    expect(end?.toDateString()).toBe(start.toDateString()); // même jour que start, pas le lendemain
  });

  it("récurrent, plusieurs créneaux le même jour : end = fermeture du DERNIER créneau", () => {
    const start = new Date("2026-08-14T09:00:00"); // vendredi
    const { end } = eventOccurrence(
      ev({
        startDateSortFormat: start.toISOString(),
        openingHours: [
          {
            dayOfWeek: dayCodeOf(start),
            hours: [{ opens: "08:00", closes: "12:00" }, { opens: "14:00", closes: "19:00" }],
          },
        ],
      }),
    );
    expect(end?.getHours()).toBe(19);
  });

  it("récurrent, openingHours sans entrée pour le jour de start : end reste null", () => {
    const start = new Date("2026-08-14T09:00:00"); // vendredi
    const otherDay = DAYS[(DAYS.indexOf(dayCodeOf(start)) + 1) % 7]; // un jour DIFFÉRENT de celui de start
    const { end } = eventOccurrence(
      ev({
        startDateSortFormat: start.toISOString(),
        openingHours: [{ dayOfWeek: otherDay, hours: [{ opens: "08:00", closes: "19:00" }] }],
      }),
    );
    expect(end).toBeNull();
  });

  it("endDate prioritaire sur openingHours quand les deux sont présents", () => {
    const start = new Date("2026-08-14T09:00:00Z"); // vendredi
    const { end } = eventOccurrence(
      ev({
        startDate: start,
        endDate: new Date("2026-08-16T00:00:00Z"),
        openingHours: [{ dayOfWeek: dayCodeOf(start), hours: [{ opens: "08:00", closes: "19:00" }] }],
      }),
    );
    expect(end?.toISOString()).toBe("2026-08-16T00:00:00.000Z");
  });
});

describe("eventOccurrence — créneau qui franchit minuit", () => {
  it("fermeture APRÈS minuit (21:00 → 01:00) : end au lendemain, pas avant le début", () => {
    const start = new Date("2026-08-14T21:00:00"); // vendredi 21 h
    const { end } = eventOccurrence(
      ev({
        startDateSortFormat: start.toISOString(),
        openingHours: [{ dayOfWeek: dayCodeOf(start), hours: [{ opens: "21:00", closes: "01:00" }] }],
      }),
    );
    expect(end!.getTime()).toBeGreaterThan(start.getTime());
    expect(end?.getHours()).toBe(1);
    expect(end?.getDate()).toBe(start.getDate() + 1);
  });

  it("fermeture à 00:00 (minuit) : lue comme la fin de la soirée, pas comme son début", () => {
    const start = new Date("2026-08-14T20:00:00");
    const { end } = eventOccurrence(
      ev({
        startDateSortFormat: start.toISOString(),
        openingHours: [{ dayOfWeek: dayCodeOf(start), hours: [{ opens: "20:00", closes: "00:00" }] }],
      }),
    );
    expect(end!.getTime()).toBeGreaterThan(start.getTime());
    expect(end?.getDate()).toBe(start.getDate() + 1);
  });
});

/**
 * `endDateSortFormat` (fin d'occurrence calculée SERVEUR, fuseau de l'event, offset PHP sans deux-points)
 * prime sur tout repli client : c'est elle qui rend « En cours » juste quel que soit le fuseau du visiteur.
 */
describe("eventOccurrence — endDateSortFormat (serveur) prioritaire", () => {
  it("récurrent borné : end = endDateSortFormat, pas l'heure de fermeture recalculée côté client", () => {
    const { start, end } = eventOccurrence(
      ev({
        startDateSortFormat: "2026-09-10T20:00:00+0200",
        endDateSortFormat: "2026-09-11T00:00:00+0200", // créneau 20:00 → 00:00 : fin le LENDEMAIN (serveur)
        openingHours: [{ dayOfWeek: "Th", hours: [{ opens: "20:00", closes: "00:00" }] }],
      }),
    );
    expect(start?.toISOString()).toBe("2026-09-10T18:00:00.000Z");
    expect(end?.toISOString()).toBe("2026-09-10T22:00:00.000Z");
  });

  it("ponctuel borné : endDateSortFormat (UTC +0000) prime sur endDate", () => {
    const { end } = eventOccurrence(ev({ startDate: new Date("2026-09-04T16:30:00Z"), endDate: new Date("2026-09-04T18:30:00Z"), endDateSortFormat: "2026-09-04T18:30:00+0000" }));
    expect(end?.toISOString()).toBe("2026-09-04T18:30:00.000Z");
  });

  it("endDateSortFormat null (ponctuel sans fin connue) → repli endDate puis openingHours, sinon null", () => {
    const { end } = eventOccurrence(ev({ startDate: new Date("2026-09-04T16:30:00Z"), endDateSortFormat: null }));
    expect(end).toBeNull();
  });
});
