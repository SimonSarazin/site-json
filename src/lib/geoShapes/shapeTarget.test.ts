import { describe, expect, it } from "vitest";
import type { GeoJsonProperties } from "geojson";

import { isLayerInteractive, shapeHref, shapeValue, type ShapeTarget } from "./shapeTarget";

/**
 * Ce que garantit ce fichier : le LIEN que porte un contour cliquable.
 *
 * Toute la chaîne est silencieuse — `shapeHref` rend `null` quand la propriété manque, et la page
 * cible (`computeFiltersFromUrl`) JETTE sans un mot une valeur qui ne matche aucune option. Un lien
 * cassé ne se voit donc pas : il mène à une page de recherche non filtrée, qui a l'air de marcher.
 * D'où le poids du test d'aller-retour d'encodage plus bas.
 */

const CIBLE: ShapeTarget = { path: "/lieux", filterId: "communes" };

/** Propriétés telles que `toFeatureCollection` les expose (`geoShapeQuery.ts`). */
function proprietes(extra: Record<string, unknown> = {}): GeoJsonProperties {
  return {
    layer: "communes",
    _id: "5e9a1b2c3d4e5f6a7b8c9d0e",
    name: "Saint-Paul",
    countryCode: "RE",
    insee: "97415",
    // La base stocke `level` en TABLEAU de chaînes — vérifié sur `zones` (`["1","3","4"]`) et sur
    // `zoniris` (`["8"]`) le 2026-08-28.
    level: ["8"],
    collection: "cities",
    ...extra,
  };
}

describe("shapeValue", () => {
  it("lit la propriété demandée par valueFrom", () => {
    expect(shapeValue(proprietes(), "name")).toBe("Saint-Paul");
    expect(shapeValue(proprietes(), "insee")).toBe("97415");
    expect(shapeValue(proprietes(), "_id")).toBe("5e9a1b2c3d4e5f6a7b8c9d0e");
    expect(shapeValue(proprietes(), "countryCode")).toBe("RE");
  });

  it("retombe sur `name` quand valueFrom est absent", () => {
    expect(shapeValue(proprietes())).toBe("Saint-Paul");
  });

  it("prend le PREMIER élément d'un `level` en tableau, jamais « 6,7 »", () => {
    // Coercer le tableau en chaîne donnerait `"1,3,4"`, qui ne matche aucune option de la page
    // cible ET que sa relecture recouperait sur la virgule : deux filtres fantômes.
    expect(shapeValue(proprietes({ level: ["1", "3", "4"] }), "level")).toBe("1");
    expect(shapeValue(proprietes({ level: ["8"] }), "level")).toBe("8");
    // Certains imports la stockent en chaîne nue : les deux formes doivent donner le même résultat.
    expect(shapeValue(proprietes({ level: "8" }), "level")).toBe("8");
    expect(shapeValue(proprietes({ level: [] }), "level")).toBeNull();
  });

  it("rend null sur une valeur absente, vide ou blanche — le contour devient du décor", () => {
    expect(shapeValue(proprietes({ name: null }))).toBeNull();
    expect(shapeValue(proprietes({ name: undefined }))).toBeNull();
    expect(shapeValue(proprietes({ name: "" }))).toBeNull();
    expect(shapeValue(proprietes({ name: "   " }))).toBeNull();
    expect(shapeValue(proprietes({ insee: null }), "insee")).toBeNull();
    expect(shapeValue(null)).toBeNull();
    expect(shapeValue({})).toBeNull();
    // Un objet ne se coerce pas en filtre : `[object Object]` serait pire qu'un lien absent.
    expect(shapeValue(proprietes({ name: { fr: "Saint-Paul" } }))).toBeNull();
  });

  it("détoure les espaces et accepte une valeur numérique", () => {
    expect(shapeValue(proprietes({ name: "  Saint-Paul  " }))).toBe("Saint-Paul");
    // `insee` arrive tantôt en `int`, tantôt en `string` selon l'import.
    expect(shapeValue(proprietes({ insee: 97415 }), "insee")).toBe("97415");
  });
});

describe("shapeHref", () => {
  it("construit `path?filterId=valeur`", () => {
    expect(shapeHref(proprietes(), CIBLE)).toBe("/lieux?communes=Saint-Paul");
    expect(shapeHref(proprietes(), { ...CIBLE, valueFrom: "insee" })).toBe("/lieux?communes=97415");
  });

  it("rend null sans valeur exploitable (pas de lien mort)", () => {
    expect(shapeHref(proprietes({ name: null }), CIBLE)).toBeNull();
    expect(shapeHref(proprietes({ name: " " }), CIBLE)).toBeNull();
    expect(shapeHref(null, CIBLE)).toBeNull();
    expect(shapeHref(proprietes(), { ...CIBLE, valueFrom: "level" })).toBe("/lieux?communes=8");
  });
});

/**
 * Relecture de l'URL À L'IDENTIQUE de la page cible (`modules/search/lib/computeFiltersFromUrl.ts`).
 * Recopiée plutôt qu'importée : c'est justement le contrat entre deux modules qu'on veut figer —
 * si la lecture change là-bas, ce test doit tomber ici.
 */
function relireCommeLaPageCible(url: string, filterId: string): string[] {
  const brut = new URLSearchParams(url.split("?")[1]).get(filterId);
  if (brut === null) return [];
  return brut
    .split(",")
    .map((v) => {
      const t = v.trim();
      try {
        return decodeURIComponent(t);
      } catch {
        return t;
      }
    })
    .filter(Boolean);
}

describe("shapeHref — aller-retour d'encodage jusqu'à la page cible", () => {
  it("rend une valeur à caractères spéciaux EN UN SEUL morceau", () => {
    // La virgule est le piège : la page cible découpe dessus AVANT de décoder. Un contour nommé
    // « Saint-Denis, Nord & Est » reviendrait sinon en deux valeurs, dont aucune ne matcherait
    // d'option — le lien mènerait à une recherche non filtrée, sans la moindre erreur visible.
    const nom = "Saint-Denis, Nord & Est — Réunion";
    const url = shapeHref(proprietes({ name: nom }), CIBLE)!;

    expect(relireCommeLaPageCible(url, "communes")).toEqual([nom]);
  });

  it("survit aussi au pourcentage, au plus et à l'apostrophe", () => {
    for (const nom of ["100% naturel", "Nord + Est", "L'Étang-Salé", "Saint-Pierre/Saint-Louis", "Bois de Nèfles"]) {
      const url = shapeHref(proprietes({ name: nom }), CIBLE)!;
      expect(relireCommeLaPageCible(url, "communes")).toEqual([nom]);
    }
  });

  it("laisse l'URL lisible pour un nom ordinaire", () => {
    // Le double encodage ne doit pas défigurer le cas courant : sans caractère spécial, les deux
    // passes sont l'identité.
    expect(shapeHref(proprietes({ name: "Saint-Paul" }), CIBLE)).toBe("/lieux?communes=Saint-Paul");
    expect(relireCommeLaPageCible("/lieux?communes=Saint-Paul", "communes")).toEqual(["Saint-Paul"]);
  });

  it("garde la clé lisible par URLSearchParams", () => {
    const url = shapeHref(proprietes(), { path: "/agenda", filterId: "zone géo" })!;
    const params = new URLSearchParams(url.split("?")[1]);
    // `computeFiltersFromUrl` itère les params et compare la clé à l'`id` du groupe : elle doit
    // revenir telle qu'elle a été déclarée en config.
    expect([...params.keys()]).toEqual(["zone géo"]);
    expect(relireCommeLaPageCible(url, "zone géo")).toEqual(["Saint-Paul"]);
  });

  it("ne produit jamais de second paramètre, même sur un nom qui contient `&` ou `=`", () => {
    for (const nom of ["Terre & Mer", "A=B", "Nord&Sud=Est"]) {
      const url = shapeHref(proprietes({ name: nom }), CIBLE)!;
      const params = new URLSearchParams(url.split("?")[1]);
      expect([...params.keys()]).toEqual(["communes"]);
      expect(relireCommeLaPageCible(url, "communes")).toEqual([nom]);
    }
  });
});

describe("isLayerInteractive", () => {
  it("rend TOUTES les couches cliquables quand `layers` est absent ou vide", () => {
    expect(isLayerInteractive("communes", CIBLE)).toBe(true);
    expect(isLayerInteractive("regions", CIBLE)).toBe(true);
    expect(isLayerInteractive("communes", { ...CIBLE, layers: [] })).toBe(true);
  });

  it("restreint la cliquabilité aux couches listées", () => {
    // Le cas d'usage : garder un contour régional englobant comme DÉCOR sous des communes
    // cliquables. Une régression ici rendrait le décor cliquable, donc capteur des clics.
    const cible: ShapeTarget = { ...CIBLE, layers: ["communes"] };
    expect(isLayerInteractive("communes", cible)).toBe(true);
    expect(isLayerInteractive("regions", cible)).toBe(false);
    expect(isLayerInteractive("", cible)).toBe(false);
  });
});
