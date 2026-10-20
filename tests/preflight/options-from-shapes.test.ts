import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { geoShapesQueryKey } from "@/lib/geoShapes/geoShapeQuery";
import type { GeoShapeSource } from "@/types/geo-shape-schema";

/**
 * Preflight — un filtre `optionsFrom.shapes` ne doit RIEN télécharger de plus que la page.
 *
 * La source `shapes` réutilise la requête de la carte : même clé, donc un seul appel réseau… à
 * condition que la déclaration reproduise celle de la couche dessinée. Or la clé n'est faite que de
 * `source`, `filters` et `simplify` (cf. `geoShapesQueryKey`) : changer le `simplify` de la carte
 * sans toucher au filtre ne casse rien de visible — ça double silencieusement le téléchargement du
 * référentiel (147 Ko gzip pour les 7 bassins de vie de Saint-Paul). C'est exactement le genre de
 * régression qu'aucune revue ne rattrape, d'où ce test.
 *
 * DEUX invariants, tous deux invisibles à l'exécution :
 *
 *  1. toute déclaration `optionsFrom.shapes` partage sa clé avec une couche déclarée sur LA MÊME page
 *     (`section.props.shapes` pour la section `map`, `section.props.map.shapes` pour les sections
 *     search) — sinon le référentiel est téléchargé deux fois ;
 *
 *  2. un contour cliquable (`props.target`) qui vise un filtre peuplé par `optionsFrom.shapes` DOIT
 *     émettre `valueFrom: "_id"`. Ces options sont identifiées par l'`_id` du document : émettre le
 *     `name` produirait un lien qui navigue bien, mais dont la valeur n'est reconnue par aucune option
 *     — l'hydratation la jette EN SILENCE et la page cible s'ouvre sans filtre.
 */
const PROJECT_ROOT = path.resolve(__dirname, "../..");

const sites: Array<{ config: string }> = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "sites.json"), "utf-8"),
);
const uniqueConfigs = [...new Set(["config.prod.json", ...sites.map((s) => s.config)])]
  .filter((f) => fs.existsSync(path.join(PROJECT_ROOT, f)))
  .sort();

interface FiltreLike {
  id: string;
  optionsFrom?: { shapes?: GeoShapeSource };
}
interface SectionLike {
  props?: {
    shapes?: GeoShapeSource[];
    map?: { shapes?: GeoShapeSource[] };
    target?: { path?: string; filterId?: string; valueFrom?: string };
    dropdownFilters?: FiltreLike[];
    filterGroups?: FiltreLike[];
  };
}
interface PageLike {
  path?: string;
  sections?: SectionLike[];
}

/** Toutes les couches dessinées par la page, quel que soit le type de section qui les porte. */
function couchesDeLaPage(page: PageLike): GeoShapeSource[] {
  return (page.sections ?? []).flatMap((s) => [
    ...(s.props?.shapes ?? []),
    ...(s.props?.map?.shapes ?? []),
  ]);
}

/** Tous les filtres de la page, dropdowns comme groupes. */
function filtresDeLaPage(page: PageLike): FiltreLike[] {
  return (page.sections ?? []).flatMap((s) => [
    ...(s.props?.dropdownFilters ?? []),
    ...(s.props?.filterGroups ?? []),
  ]);
}

/** Ceux d'entre eux que peuple un référentiel de contours. */
function filtresAContours(page: PageLike): Array<{ id: string; source: GeoShapeSource }> {
  return filtresDeLaPage(page)
    .filter((f) => f.optionsFrom?.shapes)
    .map((f) => ({ id: f.id, source: f.optionsFrom!.shapes! }));
}

/** Les cibles de navigation déclarées par les contours cliquables de la page. */
function ciblesDeLaPage(page: PageLike): Array<NonNullable<SectionLike["props"]>["target"]> {
  return (page.sections ?? []).map((s) => s.props?.target).filter(Boolean);
}

describe("Preflight — optionsFrom.shapes : aucun téléchargement en double", () => {
  test.each(uniqueConfigs)("%s", (fichier) => {
    const config = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, fichier), "utf-8"),
    ) as { pages?: PageLike[] };

    const orphelins: string[] = [];
    for (const page of config.pages ?? []) {
      const filtres = filtresAContours(page);
      if (filtres.length === 0) continue;
      const clesDessinees = new Set(
        couchesDeLaPage(page).map((s) => JSON.stringify(geoShapesQueryKey(s))),
      );
      for (const { id, source } of filtres) {
        if (clesDessinees.has(JSON.stringify(geoShapesQueryKey(source)))) continue;
        orphelins.push(
          `${page.path ?? "?"} → filtre "${id}" : sa couche (source/filters/simplify) n'est dessinée ` +
            `par aucune section de la page — le référentiel serait téléchargé une seconde fois.`,
        );
      }
    }

    expect(orphelins).toEqual([]);
  });
});

describe("Preflight — contour cliquable → filtre par `_id`", () => {
  test.each(uniqueConfigs)("%s", (fichier) => {
    const config = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, fichier), "utf-8"),
    ) as { pages?: PageLike[] };
    const pages = config.pages ?? [];

    const fautes: string[] = [];
    for (const page of pages) {
      for (const cible of ciblesDeLaPage(page)) {
        if (!cible?.filterId) continue;
        // Le filtre visé vit sur la page DE DESTINATION, pas sur celle qui porte les contours.
        const destination = pages.find((pg) => pg.path === cible.path);
        const vise = destination && filtresDeLaPage(destination).find((f) => f.id === cible.filterId);
        if (!vise?.optionsFrom?.shapes) continue;
        if (cible.valueFrom === "_id") continue;
        fautes.push(
          `${page.path ?? "?"} → target "${cible.filterId}" : valueFrom vaut ` +
            `${JSON.stringify(cible.valueFrom ?? "name (défaut)")} alors que les options du filtre sont ` +
            `identifiées par l'_id du contour — le lien n'activerait aucun filtre. Attendu : "_id".`,
        );
      }
    }

    expect(fautes).toEqual([]);
  });
});
