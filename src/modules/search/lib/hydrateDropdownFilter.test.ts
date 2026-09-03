import { describe, it, expect } from "vitest";
import { resolveFilterHydration, type FilterHydrationInput } from "./hydrateDropdownFilter";

const base: FilterHydrationInput = {
  raw: "",
  lastAppliedRaw: undefined,
  optionsReady: true,
  hasCurrentSelection: false,
  optionIds: ["la-petite-enfance", "le-handicap"],
};

describe("resolveFilterHydration", () => {
  it("premier montage, valeur d'URL valide, options prêtes : apply", () => {
    const result = resolveFilterHydration({ ...base, raw: "la-petite-enfance" });
    expect(result).toEqual({ action: "apply", ids: ["la-petite-enfance"] });
  });

  it("plusieurs ids joints par virgule : apply avec le tableau complet", () => {
    const result = resolveFilterHydration({ ...base, raw: "la-petite-enfance,le-handicap" });
    expect(result).toEqual({ action: "apply", ids: ["la-petite-enfance", "le-handicap"] });
  });

  it("id inconnu filtré, ne reste que les ids valides", () => {
    const result = resolveFilterHydration({ ...base, raw: "la-petite-enfance,fantome" });
    expect(result).toEqual({ action: "apply", ids: ["la-petite-enfance"] });
  });

  it("tous les ids inconnus : skip (rien de valide à appliquer)", () => {
    const result = resolveFilterHydration({ ...base, raw: "fantome" });
    expect(result).toEqual({ action: "skip" });
  });

  it("options pas encore prêtes (source dynamique en cours de résolution) : wait", () => {
    const result = resolveFilterHydration({ ...base, raw: "la-petite-enfance", optionsReady: false });
    expect(result).toEqual({ action: "wait" });
  });

  it("valeur déjà appliquée (identique à lastAppliedRaw) : skip, pas de re-dispatch", () => {
    const result = resolveFilterHydration({
      ...base,
      raw: "la-petite-enfance",
      lastAppliedRaw: "la-petite-enfance",
    });
    expect(result).toEqual({ action: "skip" });
  });

  it("URL sans paramètre et rien n'était sélectionné : skip (rien à faire)", () => {
    const result = resolveFilterHydration({ ...base, raw: "", hasCurrentSelection: false });
    expect(result).toEqual({ action: "skip" });
  });

  it("URL sans paramètre alors qu'une sélection est active (ex. retour arrière navigateur) : clear", () => {
    const result = resolveFilterHydration({
      ...base,
      raw: "",
      lastAppliedRaw: "la-petite-enfance",
      hasCurrentSelection: true,
    });
    expect(result).toEqual({ action: "clear" });
  });

  it("valeur encodée : décodée avant comparaison aux ids (raw = ce que renvoie déjà `searchParams.get()`, un seul niveau de décodage restant à charge de cette fonction)", () => {
    const result = resolveFilterHydration({
      ...base,
      raw: "La%20petite%20enfance",
      optionIds: ["La petite enfance"],
    });
    expect(result).toEqual({ action: "apply", ids: ["La petite enfance"] });
  });
});
