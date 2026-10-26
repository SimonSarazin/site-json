import { describe, expect, it } from "vitest";
import {
  calendarDaysBetween,
  dayKeyOf,
  daySeparatorLabel,
  formatFullWhen,
  formatTimeOfDay,
  compactWhen,
  freshnessOf,
} from "./formatWhen";

/**
 * Tous les cas fixent `timeZone: "UTC"` et un « maintenant » explicite : sans cela, la suite
 * passerait ou non selon le fuseau de la machine et l'heure du jour — exactement le genre de
 * test qui devient rouge un soir, sans qu'aucune ligne n'ait changé.
 */
const UTC = { timeZone: "UTC", locale: "fr" } as const;

/** 2026-09-23T12:00:00Z */
const NOW = Math.floor(Date.UTC(2026, 8, 23, 12, 0, 0) / 1000);
const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  Math.floor(Date.UTC(y, m - 1, d, h, min, 0) / 1000);

describe("dayKeyOf", () => {
  it("rend une clé triable AAAA-MM-JJ", () => {
    expect(dayKeyOf(at(2026, 9, 23), "UTC")).toBe("2026-09-23");
    expect(dayKeyOf(at(2026, 1, 5), "UTC")).toBe("2026-01-05");
  });

  it("dépend du fuseau demandé, pas de celui de la machine", () => {
    // 22 h UTC le 23 = déjà le 24 à Paris (UTC+2 en septembre).
    const instant = at(2026, 9, 23, 22, 30);
    expect(dayKeyOf(instant, "UTC")).toBe("2026-09-23");
    expect(dayKeyOf(instant, "Europe/Paris")).toBe("2026-09-24");
  });
});

describe("calendarDaysBetween", () => {
  it("compte des jours de calendrier, pas des tranches de 24 heures", () => {
    // 20 minutes d'écart réel, mais deux jours distincts : la frontière est le minuit local.
    const hier2350 = at(2026, 9, 22, 23, 50);
    const now0010 = at(2026, 9, 23, 0, 10);
    expect(calendarDaysBetween(hier2350, { ...UTC, now: now0010 })).toBe(1);
  });

  it("rend 0 pour le même jour, quelle que soit l'heure", () => {
    expect(calendarDaysBetween(at(2026, 9, 23, 1), { ...UTC, now: NOW })).toBe(0);
    expect(calendarDaysBetween(at(2026, 9, 23, 23), { ...UTC, now: NOW })).toBe(0);
  });

  it("franchit les mois et les années", () => {
    expect(calendarDaysBetween(at(2026, 8, 31), { ...UTC, now: at(2026, 9, 1) })).toBe(1);
    expect(calendarDaysBetween(at(2025, 12, 31), { ...UTC, now: at(2026, 1, 1) })).toBe(1);
  });
});

describe("daySeparatorLabel", () => {
  it("rend une CLÉ pour aujourd'hui et hier — la traduction reste au composant", () => {
    expect(daySeparatorLabel(at(2026, 9, 23, 8), { ...UTC, now: NOW })).toEqual({ key: "today" });
    expect(daySeparatorLabel(at(2026, 9, 22, 8), { ...UTC, now: NOW })).toEqual({ key: "yesterday" });
  });

  it("au-delà d'hier, rend une date formatée sans l'année courante", () => {
    const label = daySeparatorLabel(at(2026, 9, 12), { ...UTC, now: NOW });
    expect(label.key).toBeNull();
    expect("text" in label && label.text).toContain("12");
    expect("text" in label && label.text).not.toContain("2026");
  });

  it("affiche l'année quand elle diffère de l'année courante", () => {
    const label = daySeparatorLabel(at(2025, 9, 12), { ...UTC, now: NOW });
    expect("text" in label && label.text).toContain("2025");
  });
});

describe("formatTimeOfDay / formatFullWhen", () => {
  it("rend l'heure et la minute", () => {
    // Le séparateur varie selon la plateforme (`14:32` ou `14 h 32`) : on teste les chiffres.
    const text = formatTimeOfDay(at(2026, 9, 23, 14, 32), UTC);
    expect(text).toContain("14");
    expect(text).toContain("32");
  });

  it("rend une date longue pour les infobulles et l'accessibilité", () => {
    const text = formatFullWhen(at(2026, 9, 23, 14, 32), UTC);
    expect(text).toContain("2026");
    expect(text).toContain("23");
  });
});

describe("compactWhen", () => {
  // Le 15 juin 2026 à 14h32, heure de Paris.
  const MAINTENANT = Math.floor(Date.parse("2026-06-15T12:00:00Z") / 1000);
  const opts = { locale: "fr", timeZone: "Europe/Paris", now: MAINTENANT };

  it("rend l'HEURE pour aujourd'hui — la date serait redondante dans une liste", () => {
    const r = compactWhen(Math.floor(Date.parse("2026-06-15T08:05:00Z") / 1000), opts);
    expect(r.key).toBeNull();
    expect((r as { text: string }).text).toMatch(/10[:h]05/);
  });

  it("rend une CLÉ pour hier, que le composant traduit", () => {
    // 10:00 UTC = 12:00 à Paris le 14. (22:00Z le 14 serait déjà le 15 à Paris : le décalage
    // horaire fait basculer le jour, c'est exactement ce que `calendarDaysBetween` gère.)
    expect(compactWhen(Math.floor(Date.parse("2026-06-14T10:00:00Z") / 1000), opts)).toEqual({ key: "yesterday" });
  });

  it("rend une date courte au-delà, sans l'année si elle est courante", () => {
    const r = compactWhen(Math.floor(Date.parse("2026-03-02T10:00:00Z") / 1000), opts) as { text: string };
    expect(r.text).toMatch(/mars/);
    expect(r.text).not.toMatch(/26|2026/);
  });

  it("ajoute l'année quand elle diffère de l'année courante", () => {
    const r = compactWhen(Math.floor(Date.parse("2024-03-02T10:00:00Z") / 1000), opts) as { text: string };
    expect(r.text).toMatch(/24/);
  });

  it("compte les jours comme le séparateur du fil — les deux vues ne doivent pas diverger", () => {
    // Un fil « d'hier » dans la colonne ne doit pas s'ouvrir sur un séparateur « aujourd'hui ».
    const hier = Math.floor(Date.parse("2026-06-14T10:00:00Z") / 1000);
    expect(compactWhen(hier, opts).key).toBe(daySeparatorLabel(hier, opts).key);

    // Aujourd'hui, les deux DIVERGENT VOLONTAIREMENT : le fil écrit « aujourd'hui » en
    // séparateur, la liste affiche l'heure — répéter « aujourd'hui » sur chaque ligne d'une
    // colonne serait du bruit. C'est le seul écart, et il est ici sous surveillance.
    const tantot = Math.floor(Date.parse("2026-06-15T08:05:00Z") / 1000);
    expect(daySeparatorLabel(tantot, opts).key).toBe("today");
    expect(compactWhen(tantot, opts)).toEqual({ key: null, text: formatTimeOfDay(tantot, opts) });
  });
});

describe("freshnessOf — la dernière réponse d'une branche repliée", () => {
  it("dit l'heure aujourd'hui et hier, le jour seul au-delà", () => {
    expect(freshnessOf(at(2026, 9, 23, 9, 5), { ...UTC, now: NOW })).toEqual({ key: "todayAt", time: "09:05" });
    expect(freshnessOf(at(2026, 9, 22, 18, 30), { ...UTC, now: NOW })).toEqual({ key: "yesterdayAt", time: "18:30" });
    const vieux = freshnessOf(at(2026, 9, 18, 10, 0), { ...UTC, now: NOW });
    expect(vieux.key).toBe("onDate");
    // Sur une branche vieille de cinq jours, c'est le jour qu'on cherche, pas la minute.
    expect(vieux.key === "onDate" && vieux.date).toMatch(/^18 sept/);
  });
});
