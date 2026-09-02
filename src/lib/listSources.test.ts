import { describe, it, expect } from "vitest";
import { resolveListSources } from "./listSources";

/**
 * Ce que ces tests protègent : la fusion N sources qui remplace les trois comportements divergents
 * d'avant (socle écrasé côté filtres, serveur jamais interrogé côté formulaire, repli côté header).
 * Le cas le plus coûteux à rater est celui des `variants` inter-sources — il ne se voit pas à l'écran,
 * il fait juste rater des fiches au filtrage.
 */
describe("resolveListSources — ordre et dédoublonnage", () => {
  it("l'ordre des sources fixe la graphie retenue (le socle déclaré gagne)", () => {
    const { values } = resolveListSources([
      { values: ["La santé", "Le deuil"] },
      { values: ["la santé", "Les jeux"] },
    ]);
    expect(values).toEqual(["La santé", "Le deuil", "Les jeux"]);
  });

  it("dédoublonne casse/accents/apostrophes entre sources", () => {
    const { values } = resolveListSources([
      { values: ["L’école"] },
      { values: ["L'ECOLE", "l’école"] },
    ]);
    expect(values).toEqual(["L’école"]);
  });

  it("préserve l'ordre de première apparition, jamais d'alphabétique imposé", () => {
    // L'ordre d'un socle est celui voulu par le rédacteur de la config : on ne le trie pas.
    const { values } = resolveListSources([{ values: ["Zèbre", "Avion"] }, { values: ["Bateau"] }]);
    expect(values).toEqual(["Zèbre", "Avion", "Bateau"]);
  });

  it("ignore les valeurs vides, blanches et non-chaînes sans planter", () => {
    const { values } = resolveListSources([
      { values: ["Le deuil", "", "   ", 42 as unknown as string, null as unknown as string] },
    ]);
    expect(values).toEqual(["Le deuil"]);
  });

  it("source vide ou absente : les autres sources restent servies", () => {
    const { values } = resolveListSources([{ values: [] }, { values: ["Les jeux"] }, { values: [] }]);
    expect(values).toEqual(["Les jeux"]);
  });

  it("aucune source : rend vide, jamais undefined", () => {
    expect(resolveListSources([])).toEqual({ values: [], variants: {} });
  });
});

describe("resolveListSources — variants (le groupe interrogé par un filtre)", () => {
  it("réunit les graphies vues dans DEUX sources différentes", () => {
    // Cas parent62 : « Pêche » n'existe que sur `poi`, « pêche » que sur `events`. Sans cette union,
    // le filtre n'interroge qu'une graphie et rate toutes les fiches de l'autre collection.
    const { values, variants } = resolveListSources([
      { values: ["Pêche"] },
      { values: ["pêche"] },
    ]);
    expect(values).toEqual(["Pêche"]);
    expect(variants["Pêche"]).toEqual(["Pêche", "pêche"]);
  });

  it("réunit aussi les `variants` DÉJÀ regroupés par le serveur, source par source", () => {
    const { values, variants } = resolveListSources([
      { values: ["Le Port"], variants: { "Le Port": ["Le Port", "LE PORT"] } },
      { values: ["le port"], variants: { "le port": ["le port", "Le port "] } },
    ]);
    expect(values).toEqual(["Le Port"]);
    expect(variants["Le Port"]).toEqual(["Le Port", "LE PORT", "le port", "Le port "]);
  });

  it("pas de `variants` pour une valeur qui n'a qu'une seule graphie", () => {
    const { variants } = resolveListSources([{ values: ["Les jeux", "Le deuil"] }]);
    expect(variants).toEqual({});
  });

  it("les `variants` sont clés sur la graphie RETENUE, pas sur celle du serveur", () => {
    const { variants } = resolveListSources([
      { values: ["Pêche"] }, // socle déclaré : c'est lui qui fixe la graphie
      { values: ["pêche"], variants: { "pêche": ["pêche", "PECHE"] } },
    ]);
    expect(Object.keys(variants)).toEqual(["Pêche"]);
    expect(variants["Pêche"]).toEqual(["Pêche", "pêche", "PECHE"]);
  });

  it("ignore une graphie vide ou non-chaîne dans `variants`", () => {
    const { variants } = resolveListSources([
      { values: ["Pêche"], variants: { "Pêche": ["Pêche", "", 7 as unknown as string] } },
      { values: ["pêche"] },
    ]);
    expect(variants["Pêche"]).toEqual(["Pêche", "pêche"]);
  });
});
