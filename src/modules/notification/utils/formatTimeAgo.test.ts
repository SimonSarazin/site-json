import { describe, it, expect } from "vitest";
import { formatTimeAgo } from "./formatTimeAgo";

/**
 * `t` factice : renvoie la clé + les params interpolés, pour vérifier la
 * sélection de clé et le `count` sans dépendre d'i18next.
 */
const t = (key: string, _fallback?: string, params?: Record<string, unknown>) =>
  params && "count" in params ? `${key}:${params.count}` : key;

const NOW = 1_700_000_000_000; // référence fixe (ms)

describe("formatTimeAgo", () => {
  it("renvoie une chaîne vide sans date", () => {
    expect(formatTimeAgo(null, t, NOW)).toBe("");
    expect(formatTimeAgo(undefined, t, NOW)).toBe("");
  });

  it("'à l'instant' en dessous d'une minute", () => {
    expect(formatTimeAgo(new Date(NOW - 30_000), t, NOW)).toBe("time.now");
  });

  it("minutes", () => {
    expect(formatTimeAgo(new Date(NOW - 5 * 60_000), t, NOW)).toBe("time.minutesAgo:5");
  });

  it("heures", () => {
    expect(formatTimeAgo(new Date(NOW - 3 * 3_600_000), t, NOW)).toBe("time.hoursAgo:3");
  });

  it("jours", () => {
    expect(formatTimeAgo(new Date(NOW - 2 * 86_400_000), t, NOW)).toBe("time.daysAgo:2");
  });

  it("clamp une date future à 'à l'instant'", () => {
    expect(formatTimeAgo(new Date(NOW + 10_000), t, NOW)).toBe("time.now");
  });
});
