import { describe, it, expect, vi } from "vitest";
import { parseConsent, readConsent, writeConsent, consentFor, CONSENT_STORAGE_KEY, ANALYTICS_CATEGORY } from "./consent";

/** Stockage en mémoire : les tests ne touchent ni `window` ni le vrai localStorage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("parseConsent", () => {
  it("lit l'enregistrement écrit par le bandeau", () => {
    const rec = parseConsent(JSON.stringify({ accepted: true, preferences: { necessary: true, analytics: false }, timestamp: "2026-11-06T00:00:00.000Z" }));
    expect(rec).toEqual({ accepted: true, preferences: { necessary: true, analytics: false }, timestamp: "2026-11-06T00:00:00.000Z" });
  });

  it("tient tout ce qui n'est pas un enregistrement complet pour « aucun choix »", () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("pas du json")).toBeNull();
    expect(parseConsent("42")).toBeNull();
    expect(parseConsent(JSON.stringify({ accepted: "oui", preferences: {} }))).toBeNull();
    expect(parseConsent(JSON.stringify({ accepted: true }))).toBeNull();
  });

  it("ignore les préférences non booléennes et tolère un timestamp absent", () => {
    expect(parseConsent(JSON.stringify({ accepted: true, preferences: { analytics: "yes", necessary: true } })))
      .toEqual({ accepted: true, preferences: { necessary: true }, timestamp: "" });
  });
});

describe("readConsent / writeConsent", () => {
  it("écrit puis relit le même choix sous la clé historique", () => {
    const storage = memoryStorage();
    const written = writeConsent({ necessary: true, analytics: true }, true, storage);
    expect(storage.getItem(CONSENT_STORAGE_KEY)).toBe(JSON.stringify(written));
    expect(readConsent(storage)).toEqual(written);
    expect(written.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("sans stockage : rien à lire, et l'écriture rend quand même l'enregistrement", () => {
    expect(readConsent(null)).toBeNull();
    const rec = writeConsent({ analytics: false }, false, null);
    expect(rec.accepted).toBe(false);
  });

  it("stockage par défaut indisponible : le choix écrit reste lisible en mémoire pour la page", () => {
    // jsdom absent (environnement node) → `defaultStorage()` rend null : la mémoire seule porte le choix.
    expect(readConsent()).toBeNull();
    const rec = writeConsent({ analytics: false }, true);
    expect(readConsent()).toEqual(rec);
    expect(consentFor(readConsent(), ANALYTICS_CATEGORY)).toBe(false);
    // un stockage EXPLICITE reste pur : pas de fuite de la mémoire dans les tests
    expect(readConsent(memoryStorage())).toBeNull();
  });

  it("un stockage qui jette (quota, navigation privée) ne fait pas tomber la page", () => {
    const storage = { getItem: vi.fn(() => { throw new Error("quota"); }), setItem: vi.fn(() => { throw new Error("quota"); }), removeItem: vi.fn() };
    expect(readConsent(storage)).toBeNull();
    expect(() => writeConsent({ analytics: true }, true, storage)).not.toThrow();
  });
});

describe("consentFor", () => {
  it("null sans enregistrement", () => {
    expect(consentFor(null, ANALYTICS_CATEGORY)).toBeNull();
  });

  it("rend la préférence de la catégorie quand elle est connue", () => {
    const rec = { accepted: true, preferences: { analytics: true }, timestamp: "" };
    expect(consentFor(rec, "analytics")).toBe(true);
    expect(consentFor({ ...rec, preferences: { analytics: false } }, "analytics")).toBe(false);
  });

  it("un refus global vaut refus d'une catégorie que le bandeau ne connaissait pas", () => {
    expect(consentFor({ accepted: false, preferences: { necessary: true }, timestamp: "" }, "analytics")).toBe(false);
  });

  it("une acceptation globale vaut acceptation d'une catégorie absente (bandeau sans categories, « Tout accepter »)", () => {
    expect(consentFor({ accepted: true, preferences: { necessary: true }, timestamp: "" }, "analytics")).toBe(true);
    expect(consentFor({ accepted: true, preferences: {}, timestamp: "" }, "analytics")).toBe(true);
  });
});
