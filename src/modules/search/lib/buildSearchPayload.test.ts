import { describe, it, expect } from "vitest";
import { buildSearchPayload } from "./buildSearchPayload";

/**
 * Garde-fou du bug SSR≠client : le SSR (`prefetchSearchResults`) et le client
 * (`useSearchQuery`) doivent passer EXACTEMENT le même payload à `searchCostum`.
 * Les deux passent désormais par `buildSearchPayload` ; ces tests verrouillent
 * que les params de SCOPE (sourceKey, costumSlug, contextId…) sont bien
 * transportés — c'est leur omission côté SSR qui causait des résultats
 * différents (ex. events scopés par sourceKey uniquement côté client).
 */

const overrides = { name: "", type: ["events"] as string[] };

describe("buildSearchPayload — params de scope (parité SSR/client)", () => {
  it("transporte sourceKey depuis les baseParams", () => {
    const p = buildSearchPayload(
      { sourceKey: ["franceTierslieux", "tierslieuxbelgique"] } as never,
      overrides,
    );
    expect(p.sourceKey).toEqual(["franceTierslieux", "tierslieuxbelgique"]);
  });

  it("transporte costumSlug / contextId / contextType / costumEditMode", () => {
    const p = buildSearchPayload(
      { costumSlug: "tiersLieux", contextId: "abc", contextType: "organizations", costumEditMode: false } as never,
      overrides,
    ) as Record<string, unknown>;
    expect(p.costumSlug).toBe("tiersLieux");
    expect(p.contextId).toBe("abc");
    expect(p.contextType).toBe("organizations");
    expect(p.costumEditMode).toBe(false);
  });

  it("transporte defaultSortBy → sortBy (tri events par startDate)", () => {
    const p = buildSearchPayload({ defaultSortBy: { startDate: 1 } }, overrides);
    expect(p.sortBy).toEqual({ startDate: 1 });
  });

  it("retombe sur defaultTypes quand aucun type explicite n'est fourni", () => {
    const p = buildSearchPayload({ defaultTypes: ["events"] }, { name: "" });
    expect(p.searchType).toEqual(["events"]);
  });

  it("n'ajoute pas sourceKey si absent des baseParams", () => {
    const p = buildSearchPayload({ defaultTypes: ["events"] }, overrides) as Record<string, unknown>;
    expect("sourceKey" in p).toBe(false);
  });
});

describe("buildSearchPayload — mode carte (chargement progressif)", () => {
  it("mapUsed : pages de 500 par défaut (paginées par le paginator SDK)", () => {
    const p = buildSearchPayload({}, { ...overrides, mapUsed: true });
    expect(p).toMatchObject({ mapUsed: true, indexMin: 0, indexStep: 500 });
  });

  it("indexStepMap: 0 en config restaure le tout-en-1-appel (legacy)", () => {
    const p = buildSearchPayload({ indexStepMap: 0 }, { ...overrides, mapUsed: true });
    expect(p).toMatchObject({ mapUsed: true, indexMin: 0, indexStep: 0 });
  });

  it("indexStepMap personnalisé respecté", () => {
    const p = buildSearchPayload({ indexStepMap: 250 }, { ...overrides, mapUsed: true });
    expect(p).toMatchObject({ indexStep: 250 });
  });
});

/**
 * Gate de validation (applyValidationGate) : masque du PUBLIC les éléments EN ATTENTE via le double
 * flag legacy (preferences.toBeValidated.<slug> ET source.toBeValidated.<slug>, cf. SearchNew::getQueries:783-818).
 * Actif par défaut sur les collections « élément » scopées costum ; jamais en admin / réseau-wide / news.
 */
describe("buildSearchPayload — gate de validation (double flag toBeValidated)", () => {
  const poi = { name: "", type: ["poi"] as string[] };

  it("pose les DEUX flags $exists:false quand un costum est scopé (public)", () => {
    const p = buildSearchPayload({ costumSlug: "sportSanteBienetre" } as never, poi) as Record<string, unknown>;
    expect(p.filters).toEqual({
      "preferences.toBeValidated.sportSanteBienetre": { $exists: false },
      "source.toBeValidated.sportSanteBienetre": { $exists: false },
    });
  });

  it("préserve les defaultFilters existants et ajoute les deux flags", () => {
    const p = buildSearchPayload(
      { costumSlug: "sportSanteBienetre", defaultFilters: { type: "article" } } as never,
      poi,
    ) as Record<string, unknown>;
    expect(p.filters).toMatchObject({
      type: "article",
      "preferences.toBeValidated.sportSanteBienetre": { $exists: false },
      "source.toBeValidated.sportSanteBienetre": { $exists: false },
    });
  });

  it("NE s'applique PAS en variant admin (l'admin voit les en-attente)", () => {
    const p = buildSearchPayload({ costumSlug: "sportSanteBienetre" } as never, { ...poi, variant: "admin" }) as Record<string, unknown>;
    expect(p.filters).toBeUndefined();
  });

  it("NE s'applique PAS si showUnvalidated (opt-out, miroir showTobevaledated)", () => {
    const p = buildSearchPayload({ costumSlug: "sportSanteBienetre", showUnvalidated: true } as never, poi) as Record<string, unknown>;
    expect(p.filters).toBeUndefined();
  });

  it("NE s'applique PAS en réseau-wide (notSourceKey)", () => {
    const p = buildSearchPayload({ costumSlug: "sportSanteBienetre", notSourceKey: true } as never, poi) as Record<string, unknown>;
    expect(p.filters).toBeUndefined();
  });

  it("NE s'applique PAS sans costumSlug", () => {
    const p = buildSearchPayload({} as never, poi) as Record<string, unknown>;
    expect(p.filters).toBeUndefined();
  });

  it("NE s'applique PAS aux collections non-élément (news : visibilité par scope)", () => {
    const p = buildSearchPayload({ costumSlug: "sportSanteBienetre" } as never, { name: "", type: ["news"] }) as Record<string, unknown>;
    // Pas de gate toBeValidated pour news ; l'exclusion des items de fil est faite par la LIB (searchCostum),
    // plus par buildSearchPayload → aucun `filters` produit ici.
    expect(p.filters).toBeUndefined();
  });

  it("s'applique aux sous-types d'organisation (NGO)", () => {
    const p = buildSearchPayload({ costumSlug: "sportSanteBienetre" } as never, { name: "", type: ["NGO"] }) as Record<string, unknown>;
    expect(p.filters).toMatchObject({ "source.toBeValidated.sportSanteBienetre": { $exists: false } });
  });
});

describe("buildSearchPayload — news : l'exclusion des items de fil est déléguée à la lib (searchCostum)", () => {
  // La logique `withNewsActivityExclusion` vit désormais dans la lib (BaseEntity), appliquée par
  // `entity.searchCostum`. `buildSearchPayload` ne fait donc plus que transporter les defaultFilters.
  it("passe les defaultFilters ($or localité/source) TELS QUELS, sans injecter d'exclusion `type`", () => {
    const p = buildSearchPayload(
      { defaultTypes: ["news"], notSourceKey: true, defaultFilters: { $or: { "source.keys": "etangsale1" } } } as never,
      { name: "", type: undefined as unknown as string[] },
    ) as Record<string, unknown>;
    expect(p.filters).toEqual({ $or: { "source.keys": "etangsale1" } });
  });
});
