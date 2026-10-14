import { describe, it, expect } from "vitest";
import {
  buildFinderMongoFilters,
  buildFinderSearchParams,
  placeKindSourceKeys,
  primaryFinderType,
  PLACE_KIND_SOURCE_KEYS,
} from "./finderFilters";
import type { FinderFilter } from "../types";

describe("buildFinderMongoFilters", () => {
  it("sans filtre → objet vide", () => {
    expect(buildFinderMongoFilters([])).toEqual({});
    expect(buildFinderMongoFilters([], [])).toEqual({});
  });

  it("inclusion mono-valeur → scalaire (comportement historique)", () => {
    const include: FinderFilter[] = [
      { attributeName: "tags", valueName: "TiersLieux" },
      { attributeName: "source.key", valueName: "tlorg" },
    ];
    expect(buildFinderMongoFilters(include)).toEqual({
      tags: "TiersLieux",
      "source.key": "tlorg",
    });
  });

  it("inclusion multi-valeur sur une même clé → $in", () => {
    const include: FinderFilter[] = [
      { attributeName: "tags", valueName: "A" },
      { attributeName: "tags", valueName: "B" },
    ];
    expect(buildFinderMongoFilters(include)).toEqual({ tags: { $in: ["A", "B"] } });
  });

  it("exclusion seule (attribut sans inclusion) → $nin, pas de $or", () => {
    const out = buildFinderMongoFilters([], [
      { attributeName: "tags", valueName: "RéseauTiersLieux" },
    ]);
    expect(out).toEqual({ tags: { $nin: ["RéseauTiersLieux"] } });
    expect(out.$or).toBeUndefined();
  });

  it("collision inclusion+exclusion sur `tags` → idiome prouvé $or + $nin", () => {
    const out = buildFinderMongoFilters(
      [{ attributeName: "tags", valueName: "TiersLieux" }],
      [{ attributeName: "tags", valueName: "RéseauTiersLieux" }],
    );
    // Reproduit exactement la config search tiers-lieux vérifiée en base.
    expect(out).toEqual({
      $or: { tags: { $in: ["TiersLieux"] } },
      tags: { $nin: ["RéseauTiersLieux"] },
    });
  });

  it("inclusion sur un attribut, exclusion sur un AUTRE → pas de $or", () => {
    const out = buildFinderMongoFilters(
      [{ attributeName: "tags", valueName: "TiersLieux" }],
      [{ attributeName: "category", valueName: "network" }],
    );
    expect(out).toEqual({
      tags: "TiersLieux",
      category: { $nin: ["network"] },
    });
    expect(out.$or).toBeUndefined();
  });

  it("exclusion multi-valeur groupée → un seul $nin", () => {
    const out = buildFinderMongoFilters([], [
      { attributeName: "tags", valueName: "RéseauTiersLieux" },
      { attributeName: "tags", valueName: "Fédération" },
    ]);
    expect(out).toEqual({ tags: { $nin: ["RéseauTiersLieux", "Fédération"] } });
  });

  it("le paramètre exclude est optionnel (défaut = [])", () => {
    expect(buildFinderMongoFilters([{ attributeName: "type", valueName: "NGO" }])).toEqual({
      type: "NGO",
    });
  });

  // Épingle la limite documentée : ≥2 attributs en collision fusionnent sous un
  // seul `$or`-objet (sémantique OR côté backend). Cas exotique non requis par
  // les finders réels — ce test fige le comportement, il ne le cautionne pas.
  it("collision multi-attributs → un seul $or (limite connue du DSL)", () => {
    const out = buildFinderMongoFilters(
      [
        { attributeName: "tags", valueName: "A" },
        { attributeName: "category", valueName: "C" },
      ],
      [
        { attributeName: "tags", valueName: "X" },
        { attributeName: "category", valueName: "Y" },
      ],
    );
    expect(out).toEqual({
      $or: { tags: { $in: ["A"] }, category: { $in: ["C"] } },
      tags: { $nin: ["X"] },
      category: { $nin: ["Y"] },
    });
  });
});

describe("buildFinderSearchParams", () => {
  it("finder sans filtre, global → searchType seul + notSourceKey", () => {
    expect(
      buildFinderSearchParams({ type: "organizations", filters: [], notSourceKey: true }),
    ).toEqual({ searchType: ["organizations"], notSourceKey: true });
  });

  it("inclusions + exclusions → même DSL que buildFinderMongoFilters", () => {
    const filters: FinderFilter[] = [{ attributeName: "tags", valueName: "CAE" }];
    const excludeFilters: FinderFilter[] = [{ attributeName: "tags", valueName: "Réseau" }];
    expect(
      buildFinderSearchParams({ type: "organizations", filters, excludeFilters, notSourceKey: true }),
    ).toEqual({
      searchType: ["organizations"],
      filters: buildFinderMongoFilters(filters, excludeFilters),
      notSourceKey: true,
    });
  });

  // `false` partirait en chaîne "false" (form-urlencoded), lue comme ACTIVE par
  // la garde serveur : la clé doit être ABSENTE pour que le SDK borne au costum.
  it("notSourceKey à false → clé absente, jamais `false`", () => {
    const out = buildFinderSearchParams({ type: "organizations", filters: [], notSourceKey: false });
    expect(out).toEqual({ searchType: ["organizations"] });
    expect("notSourceKey" in out).toBe(false);
  });

  it("type déjà en tableau → conservé tel quel", () => {
    expect(
      buildFinderSearchParams({ type: ["organizations", "projects"], filters: [], notSourceKey: true })
        .searchType,
    ).toEqual(["organizations", "projects"]);
  });

  // La seule PRÉSENCE de `notSourceKey` désarme le périmètre côté serveur : avec
  // un `sourceKey`, il doit disparaître, même si le finder le déclare à `true`.
  it("sourceKey non vide → émis, et notSourceKey absent même si le finder le veut", () => {
    const out = buildFinderSearchParams({
      type: "organizations",
      filters: [{ attributeName: "tags", valueName: "TiersLieux" }],
      notSourceKey: true,
      sourceKey: ["franceTierslieux"],
    });
    expect(out).toEqual({
      searchType: ["organizations"],
      filters: { tags: "TiersLieux" },
      sourceKey: ["franceTierslieux"],
    });
    expect("notSourceKey" in out).toBe(false);
  });

  it("sourceKey vide → comportement sans périmètre explicite", () => {
    expect(
      buildFinderSearchParams({ type: "organizations", filters: [], notSourceKey: true, sourceKey: [] }),
    ).toEqual({ searchType: ["organizations"], notSourceKey: true });
  });
});

describe("primaryFinderType", () => {
  it("un type seul est rendu tel quel", () => {
    expect(primaryFinderType("projects")).toBe("projects");
  });

  it("une LISTE de types → le premier", () => {
    expect(primaryFinderType(["organizations", "projects"])).toBe("organizations");
    expect(primaryFinderType(["projects", "organizations"])).toBe("projects");
  });

  it("une config sans type ne lève pas : `undefined`, comme avant ce helper", () => {
    expect(primaryFinderType(undefined as never)).toBeUndefined();
    expect(primaryFinderType([])).toBeUndefined();
  });
});

describe("placeKindSourceKeys", () => {
  it("défaut → tiers-lieux (source franceTierslieux)", () => {
    expect(placeKindSourceKeys()).toEqual(["franceTierslieux"]);
    expect(placeKindSourceKeys("tiersLieu")).toEqual(["franceTierslieux"]);
  });

  it("cae → source federationDesCae", () => {
    expect(placeKindSourceKeys("cae")).toEqual(["federationDesCae"]);
  });

  it("rend une copie : le préréglage partagé n'est jamais muté", () => {
    placeKindSourceKeys("cae").push("autre");
    expect(PLACE_KIND_SOURCE_KEYS.cae).toEqual(["federationDesCae"]);
  });

  it("surcharge de config non vide → l'emporte sur le préréglage de la nature", () => {
    expect(placeKindSourceKeys("tiersLieu", ["franceTierslieux", "tierslieuxbelgique"])).toEqual([
      "franceTierslieux",
      "tierslieuxbelgique",
    ]);
    expect(placeKindSourceKeys(undefined, ["autreCostum"])).toEqual(["autreCostum"]);
  });

  // La config n'est pas parsée au runtime : la surcharge arrive brute du JSON.
  it("surcharge vide ou invalide → préréglage (chaînes vides et non-chaînes écartées)", () => {
    expect(placeKindSourceKeys("cae", [])).toEqual(["federationDesCae"]);
    expect(placeKindSourceKeys("cae", ["", "  ", 42, null])).toEqual(["federationDesCae"]);
    expect(placeKindSourceKeys("cae", ["", "ok", 42])).toEqual(["ok"]);
  });

  it("surcharge rendue en copie : le tableau de la config n'est jamais muté", () => {
    const config = ["a"];
    placeKindSourceKeys("cae", config).push("b");
    expect(config).toEqual(["a"]);
  });

  it("nature inconnue (config brute) → tiers-lieux, sans exception", () => {
    expect(placeKindSourceKeys("scic" as never)).toEqual(["franceTierslieux"]);
    expect(placeKindSourceKeys("toString" as never)).toEqual(["franceTierslieux"]);
  });
});
