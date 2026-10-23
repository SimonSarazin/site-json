/**
 * Logique PURE de la REQUÊTE de doublons : le terme envoyé au serveur et le périmètre cherché.
 * Pendant de `entityDuplicates.ts` (qui classe ce que la requête a ramené). Aucune dépendance
 * React — testé à part.
 */
import { findSectionByRef } from "@/lib/sectionContainers";
import { mergeMongoFilters } from "@/modules/search/lib/mongoFilters";
import { SearchBaseParamsSchema, type SearchBaseParams, type SearchType } from "@/modules/search/schema";
import type { SiteConfig } from "@/types/site";

import { DUPLICATE_FETCH_LIMIT } from "./entityDuplicates";
import type { DuplicateCheckSpec } from "../forms/entityModalSpec";

/** Ce que la résolution du périmètre lit d'une config de site. */
export type DuplicateSiteConfig = Pick<SiteConfig, "pages"> | null | undefined;

/**
 * `baseParams` de la recherche de doublons : le PÉRIMÈTRE de la section référencée (filtres,
 * provenance, localité, contexte…), plus ce que la détection IMPOSE (types, projection, champ
 * cherché, taille de page).
 */
export interface DuplicateBaseParams extends Omit<SearchBaseParams, "defaultSortBy" | "indexStepMap" | "costumSubType"> {
  defaultTypes: SearchType[];
  defaultFields: string[];
  searchBy: string[];
  indexStepList: number;
}

/** Champs projetés : de quoi nommer, situer et ouvrir une fiche. `fields` est ADDITIF côté serveur
 *  (il ne réduit pas la réponse) — la liste dit ce dont l'affichage dépend, pas ce qui est renvoyé. */
const DUPLICATE_FIELDS = ["name", "collection", "slug", "address", "profilImageUrl", "profilMediumImageUrl", "shortDescription", "tags"];

/**
 * Terme de recherche : la saisie, débarrassée de ce qui la ferait échouer côté serveur. Le serveur
 * cherche par expression régulière insensible à la casse et aux accents, mais PAS à la ponctuation :
 * « L’Archipel » tapé sur mobile (apostrophe typographique) ne retrouve pas « L'Archipel ». Chaque
 * apostrophe et chaque tiret devient donc UN espace.
 *
 * Les espaces ne sont PAS repliés. Le serveur traduit chaque espace du terme en UN séparateur
 * optionnel (`[\s'-]?`, `SearchNew::accentToRegex`) : un nom stocké « A - B » porte trois caractères
 * entre A et B et exige trois espaces. Replier rendait introuvables par leur propre nom les fiches
 * à séparateur espacé — 243 des 4 305 fiches de l'annuaire des tiers-lieux (5,6 %), dont
 * « Coworking Haute-Deûle - En cours ». Garder les espaces donne un motif plus large, jamais plus
 * étroit (« A   B » retrouve « A - B », « A-B » et « A B »).
 *
 * N'est PAS `foldText` : celui-ci retire toute la ponctuation et perd des fiches (« archipel l »
 * ne retrouve rien, « Archipel (L ) » si). On plie pour comparer, on nettoie pour chercher.
 */
export function toSearchTerm(name: unknown): string {
  if (typeof name !== "string") return "";
  return name
    .replace(/[\u0027\u2018\u2019\u02bc\u0060\u00b4]/g, " ") // apostrophes droite, typographiques, accents isolés
    .replace(/[\u002d\u2010-\u2015]/g, " ") // tirets
    .trim();
}

/**
 * `baseParams` BRUTS d'une section de recherche du site, désignée par le chemin de sa PAGE et son
 * id. Le chemin est requis : un id de section n'est pas unique dans une config (sur le site des
 * tiers-lieux, `section-events` désigne l'agenda de l'accueil ET l'annuaire de `/lieux`). `null`
 * si rien ne correspond.
 */
export function resolveSectionBaseParams(config: DuplicateSiteConfig, ref: { page: string; sectionId: string }): unknown {
  const baseParams = findSectionByRef(config?.pages, ref)?.props?.baseParams;
  return baseParams && typeof baseParams === "object" ? baseParams : null;
}

/**
 * Périmètre de la recherche de doublons : celui que déclare `search` — par RÉFÉRENCE à une section
 * du site (`from`, zéro recopie : le périmètre suit l'annuaire) ou en ligne (`filters`…).
 *
 * HÉRITÉ de la section : tout ce qui délimite CE QU'ON cherche — `defaultFilters`, `defaultTags`,
 * `notSourceKey`, `sourceKey`, `locality`, `fediverse`, `costumSlug`, `contextId`, `contextType`…
 * Les filtres en ligne se COMPOSENT avec les filtres hérités (`mergeMongoFilters` : un `$or` en
 * ligne ne détruit pas le `$or` de périmètre).
 * JAMAIS hérité, parce que ça décrit la PRÉSENTATION de l'annuaire et non son périmètre :
 *  - `searchBy`, imposé à `["name"]` — un annuaire cherche aussi dans la commune et le code postal
 *    (95 résultats pour « Lyon », 22 sur le nom seul) ;
 *  - `defaultSortBy` et le variant — le défaut serveur suffit, le classement est fait ici ;
 *  - `defaultFields`, `indexStepList`, `indexStepMap`, `defaultTypes` — imposés (cf. `DUPLICATE_FETCH_LIMIT`).
 *
 * Rend `null` — et l'appelant ne cherche PAS, plutôt que de chercher hors périmètre — quand la
 * référence ne résout rien, que ses `baseParams` sont malformés, ou que la section délimite son
 * périmètre par `costumSubType` : ce sous-type se résout contre la déclaration des formulaires du
 * site, que cette fonction ne connaît pas.
 */
export function buildDuplicateBaseParams(
  search: DuplicateCheckSpec["search"],
  config: DuplicateSiteConfig,
  fetchLimit: number = DUPLICATE_FETCH_LIMIT,
): DuplicateBaseParams | null {
  const raw = search.from ? resolveSectionBaseParams(config, search.from) : {};
  if (raw === null) return null;
  const parsed = SearchBaseParamsSchema.safeParse(raw);
  if (!parsed.success || parsed.data.costumSubType) return null;

  const {
    searchBy: _searchBy, defaultSortBy: _sort, defaultFields: _fields, indexStepList: _step, indexStepMap: _stepMap,
    defaultTypes: _types, costumSubType: _subType, defaultFilters: inheritedFilters, ...perimeter
  } = parsed.data;
  const filters = mergeMongoFilters(inheritedFilters ?? {}, search.filters ?? {});
  return {
    ...perimeter,
    ...(Object.keys(filters).length ? { defaultFilters: filters } : {}),
    ...(search.notSourceKey !== undefined ? { notSourceKey: search.notSourceKey } : {}),
    ...(search.sourceKey ? { sourceKey: search.sourceKey } : {}),
    defaultTypes: search.types,
    defaultFields: DUPLICATE_FIELDS,
    searchBy: ["name"],
    indexStepList: fetchLimit,
  };
}
