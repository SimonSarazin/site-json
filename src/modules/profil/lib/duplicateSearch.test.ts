import { describe, it, expect } from "vitest";
import { buildDuplicateBaseParams, resolveSectionBaseParams, toSearchTerm, type DuplicateSiteConfig } from "./duplicateSearch";

/**
 * Deux choses peuvent rendre l'alerte muette sans que rien ne le dise : un terme que le serveur ne
 * sait pas retrouver (apostrophe typographique d'un clavier mobile), et un périmètre résolu sur la
 * MAUVAISE section (deux sections portent le même id sur le site des tiers-lieux).
 */
const LIEUX = {
  defaultTypes: ["organizations"],
  defaultFilters: { $or: { tags: { $in: ["TiersLieux"] } }, tags: { $nin: ["RéseauTiersLieux"] } },
  defaultSortBy: { updated: -1 },
  searchBy: ["name", "address.addressLocality", "address.postalCode"],
  indexStepList: 20,
  notSourceKey: true,
};
/** Config de site minimale : seules `pages[].path` et `pages[].sections` sont lues. */
const asConfig = (value: unknown) => value as DuplicateSiteConfig;
const config = asConfig({
  pages: [
    { path: "/", sections: [{ type: "agenda", id: "section-events", props: { baseParams: { sourceKey: ["franceTierslieux"] } } }] },
    {
      path: "/lieux",
      sections: [
        { type: "gridLayout", id: "grid", props: { rightSection: { type: "searchProStatic", id: "section-events", props: { baseParams: LIEUX } } } },
        { type: "searchProStatic", id: "par-sous-type", props: { baseParams: { costumSubType: "financement" } } },
        { type: "searchProStatic", id: "malformee", props: { baseParams: { defaultTypes: "organizations" } } },
        { type: "searchProStatic", id: "localisee", props: { baseParams: { defaultTags: ["Fablab"], fediverse: true, contextId: "abc", contextType: "organizations", sourceKey: ["monSite"] } } },
      ],
    },
  ],
});

describe("toSearchTerm", () => {
  it("remplace apostrophes (droite et typographiques) et tirets par un espace", () => {
    expect(toSearchTerm("L’Archipel")).toBe("L Archipel");
    expect(toSearchTerm("L'Archipel")).toBe("L Archipel");
    expect(toSearchTerm("la-plume-a-loup")).toBe("la plume a loup");
  });

  it("garde casse, accents et parenthèses : le serveur les gère, le repli les perdrait", () => {
    expect(toSearchTerm("  La Plume à Loup ")).toBe("La Plume à Loup");
    expect(toSearchTerm("Archipel (L')")).toBe("Archipel (L )");
  });

  it("ne replie PAS les espaces : « A - B » exige trois séparateurs côté serveur", () => {
    // Le serveur traduit chaque espace en UN séparateur optionnel. Cas réel : la fiche
    // « Coworking Haute-Deûle - En cours » était introuvable par son propre nom avec un seul espace.
    expect(toSearchTerm("Coworking Haute-Deûle - En cours")).toBe("Coworking Haute Deûle   En cours");
    expect(toSearchTerm("L' Avoir")).toBe("L  Avoir");
  });

  it("chaîne vide pour une valeur non textuelle", () => {
    expect(toSearchTerm(undefined)).toBe("");
    expect(toSearchTerm(42)).toBe("");
  });
});

describe("resolveSectionBaseParams", () => {
  it("résout par PAGE puis id, en traversant les conteneurs (gridLayout)", () => {
    expect(resolveSectionBaseParams(config, { page: "/lieux", sectionId: "section-events" })).toBe(LIEUX);
  });

  it("ne confond pas deux sections de même id sur deux pages", () => {
    expect(resolveSectionBaseParams(config, { page: "/", sectionId: "section-events" })).toEqual({ sourceKey: ["franceTierslieux"] });
  });

  it("null si la page ou la section n'existe pas", () => {
    expect(resolveSectionBaseParams(config, { page: "/absente", sectionId: "section-events" })).toBeNull();
    expect(resolveSectionBaseParams(config, { page: "/lieux", sectionId: "absente" })).toBeNull();
    expect(resolveSectionBaseParams(null, { page: "/lieux", sectionId: "section-events" })).toBeNull();
  });
});

describe("buildDuplicateBaseParams", () => {
  it("hérite des filtres et de notSourceKey de la section, mais IMPOSE searchBy et la taille de page", () => {
    const bp = buildDuplicateBaseParams({ types: ["organizations"], from: { page: "/lieux", sectionId: "section-events" } }, config);
    expect(bp).toMatchObject({
      defaultTypes: ["organizations"],
      defaultFilters: LIEUX.defaultFilters,
      searchBy: ["name"],
      notSourceKey: true,
      indexStepList: 50,
    });
    // Ni tri hérité (le classement est fait côté client), ni les 3 chemins de recherche de l'annuaire.
    expect(bp).not.toHaveProperty("defaultSortBy");
    expect(bp?.defaultFields).toContain("slug");
  });

  it("rend null quand la référence ne résout rien : on ne cherche pas hors périmètre", () => {
    expect(buildDuplicateBaseParams({ types: ["organizations"], from: { page: "/lieux", sectionId: "absente" } }, config)).toBeNull();
  });

  it("hérite de TOUT le périmètre de la section (tags, fédiverse, contexte, provenance), pas seulement des filtres", () => {
    expect(buildDuplicateBaseParams({ types: ["organizations"], from: { page: "/lieux", sectionId: "localisee" } }, config)).toMatchObject({
      defaultTags: ["Fablab"],
      fediverse: true,
      contextId: "abc",
      contextType: "organizations",
      sourceKey: ["monSite"],
    });
  });

  it("refuse une section délimitée par costumSubType, ou dont les baseParams sont malformés", () => {
    expect(buildDuplicateBaseParams({ types: ["poi"], from: { page: "/lieux", sectionId: "par-sous-type" } }, config)).toBeNull();
    expect(buildDuplicateBaseParams({ types: ["organizations"], from: { page: "/lieux", sectionId: "malformee" } }, config)).toBeNull();
  });

  it("un $or en ligne se COMPOSE avec le $or de périmètre au lieu de l'écraser", () => {
    const bp = buildDuplicateBaseParams(
      { types: ["organizations"], from: { page: "/lieux", sectionId: "section-events" }, filters: { $or: { "address.postalCode": "62170" } } },
      config,
    );
    expect(bp?.defaultFilters?.$or).toEqual({
      $and: [{ $or: [{ tags: { $in: ["TiersLieux"] } }] }, { $or: [{ "address.postalCode": "62170" }] }],
    });
  });

  it("périmètre en ligne, sans référence ; `filters` en ligne passe par-dessus l'hérité", () => {
    expect(buildDuplicateBaseParams({ types: ["poi"], filters: { type: "ressource" }, sourceKey: ["monSite"] }, config, 10)).toEqual({
      defaultTypes: ["poi"],
      defaultFilters: { type: "ressource" },
      defaultFields: expect.any(Array),
      searchBy: ["name"],
      sourceKey: ["monSite"],
      indexStepList: 10,
    });
    const merged = buildDuplicateBaseParams(
      { types: ["organizations"], from: { page: "/lieux", sectionId: "section-events" }, filters: { tags: { $nin: ["Autre"] } } },
      config,
    );
    expect(merged?.defaultFilters).toEqual({ $or: { tags: { $in: ["TiersLieux"] } }, tags: { $nin: ["Autre"] } });
  });
});
