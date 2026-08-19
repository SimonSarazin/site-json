import { describe, it, expect } from "vitest";

import { applyValidationGate } from "./validationGate";

/**
 * PORTE DE VALIDATION — contrat de la fonction PARTAGÉE.
 *
 * Elle vivait privée dans `buildSearchPayload` ; les trois surfaces qui n'empruntent pas ce chemin
 * (agenda → `searchEventsCostum`, palette ⌘K → `searchCostum` direct, observatoire → liste blanche
 * de baseParams) ont chacune découvert son absence par un bug de VISIBILITÉ : des fiches en attente
 * de validation publiées au public. Ces tests verrouillent le contrat pour ses quatre appelants.
 */
describe("applyValidationGate", () => {
  const CLAUSES = {
    "preferences.toBeValidated.monSite": { $exists: false },
    "source.toBeValidated.monSite": { $exists: false },
  };

  it("pose les DEUX voies legacy (preferences ET source) et préserve les filtres existants", () => {
    expect(applyValidationGate({ type: "article" }, { costumSlug: "monSite" })).toEqual({
      type: "article",
      ...CLAUSES,
    });
  });

  it("sans filtres préalables : les deux clauses seules", () => {
    expect(applyValidationGate(undefined, { costumSlug: "monSite" })).toEqual(CLAUSES);
  });

  // Les 4 sorties. Chacune correspond à un cas où le gate serait FAUX, pas seulement inutile.
  it("sans costumSlug : AUCUNE porte (on ne sait pas quel slug indexer)", () => {
    expect(applyValidationGate({ a: 1 }, {})).toEqual({ a: 1 });
    expect(applyValidationGate({ a: 1 }, { costumSlug: "" })).toEqual({ a: 1 });
    expect(applyValidationGate(undefined, { costumSlug: 42 })).toBeUndefined();
  });

  it("variant admin : pas de porte — l'admin DOIT voir ce qu'il a à valider", () => {
    expect(applyValidationGate({ a: 1 }, { costumSlug: "monSite", variant: "admin" })).toEqual({ a: 1 });
  });

  it("showUnvalidated : opt-out explicite (miroir du showTobevaledated legacy)", () => {
    expect(applyValidationGate({ a: 1 }, { costumSlug: "monSite", showUnvalidated: true })).toEqual({ a: 1 });
  });

  it("notSourceKey PHP-truthy : réseau-wide, donc pas de costum de scope", () => {
    for (const v of [true, 1, "1"]) {
      expect(applyValidationGate({ a: 1 }, { costumSlug: "monSite", notSourceKey: v })).toEqual({ a: 1 });
    }
    // …mais les valeurs PHP-falsy ne débranchent PAS la porte.
    for (const v of [false, 0, "0", undefined]) {
      expect(applyValidationGate(undefined, { costumSlug: "monSite", notSourceKey: v })).toEqual(CLAUSES);
    }
  });

  it("types hors collections « élément » : news/answers ont un autre modèle de visibilité", () => {
    expect(applyValidationGate(undefined, { costumSlug: "monSite", types: ["news"] })).toBeUndefined();
    // un seul type non validable dans le lot suffit à tout désarmer
    expect(applyValidationGate(undefined, { costumSlug: "monSite", types: ["poi", "news"] })).toBeUndefined();
    expect(applyValidationGate(undefined, { costumSlug: "monSite", types: ["poi", "events"] })).toEqual(CLAUSES);
  });

  it("IDEMPOTENTE : l'appliquer sur des filtres qui portent déjà la garde ne change rien", () => {
    // Cas réel : rezo-sante-reunion et saint-paul-sport ont recopié les deux clauses à la main dans
    // leur config. Le jour où la porte s'arme aussi côté code, les deux doivent coexister sans conflit.
    const dejaGarde = { ...CLAUSES };
    expect(applyValidationGate(dejaGarde, { costumSlug: "monSite" })).toEqual(CLAUSES);
  });
});
