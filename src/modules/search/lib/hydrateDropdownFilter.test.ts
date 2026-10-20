import { describe, it, expect } from "vitest";
import { resolveFilterHydration, type FilterHydrationInput } from "./hydrateDropdownFilter";
import type { DropdownOptionConfig } from "./dropdownFilters";

/** Option telle que `useDynamicFilterOptions` la rend : un socle de config garde son id de SLUG,
 *  sa `value` (la graphie stockée en base) et son libellé traduit. */
const opt = (id: string, value?: string, labelFr?: string): DropdownOptionConfig =>
  ({ id, ...(value ? { value } : {}), label: { fr: labelFr ?? value ?? id, en: labelFr ?? value ?? id } }) as DropdownOptionConfig;

const base: FilterHydrationInput = {
  raw: "",
  lastAppliedRaw: undefined,
  optionsReady: true,
  hasCurrentSelection: false,
  options: [opt("la-petite-enfance", "La petite enfance"), opt("le-handicap", "Le handicap")],
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

  it("valeur encodée : décodée avant rapprochement (raw = ce que renvoie déjà `searchParams.get()`, un seul niveau de décodage restant à charge de cette fonction)", () => {
    const result = resolveFilterHydration({
      ...base,
      raw: "La%20petite%20enfance",
      options: [opt("La petite enfance")],
    });
    expect(result).toEqual({ action: "apply", ids: ["La petite enfance"] });
  });

  // ── Rapprochement par la VALEUR affichée, pas seulement par l'id ────────────────────────────
  // Le cas d'usage : un menu `dynamicList` du header engendre ses liens depuis `costum.lists`, donc
  // avec la valeur BRUTE de la base (« La santé »), tandis que l'option correspondante de la page
  // cible vient du socle de config et garde son id de slug (`withDeclared`). Comparer aux seuls ids
  // rendait `skip` : le visiteur arrivait sur la bonne page, NON filtrée, sans le moindre signe.

  it("valeur affichée au lieu de l'id : appliquée sous l'id de l'option (lien engendré par un menu dynamicList)", () => {
    const result = resolveFilterHydration({ ...base, raw: "La petite enfance" });
    expect(result).toEqual({ action: "apply", ids: ["la-petite-enfance"] });
  });

  it("graphie différente de la valeur (casse, accents, apostrophe) : même option", () => {
    const result = resolveFilterHydration({
      ...base,
      raw: "LA PETITE ENFANCE",
    });
    expect(result).toEqual({ action: "apply", ids: ["la-petite-enfance"] });
  });

  it("libellé traduit dans l'URL : reconnu aussi (dernier maillon de `resolveOptionInList`)", () => {
    const result = resolveFilterHydration({
      ...base,
      options: [opt("le-repit", "Le répit", "Le répit")],
      raw: "Le répit",
    });
    expect(result).toEqual({ action: "apply", ids: ["le-repit"] });
  });

  it("deux graphies de la MÊME option : un seul id, pas de doublon de sélection", () => {
    const result = resolveFilterHydration({ ...base, raw: "la-petite-enfance,La petite enfance" });
    expect(result).toEqual({ action: "apply", ids: ["la-petite-enfance"] });
  });

  it("option issue de la base seule (pas de socle) : id = valeur, inchangé", () => {
    const result = resolveFilterHydration({
      ...base,
      options: [opt("Alimentation", "Alimentation")],
      raw: "Alimentation",
    });
    expect(result).toEqual({ action: "apply", ids: ["Alimentation"] });
  });
});
