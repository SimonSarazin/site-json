import type { FinderConfig, FinderElementType, FinderFilter } from "../types";

/**
 * Construit les filtres MongoDB (DSL legacy `SearchNew::searchFilters`) à partir
 * des filtres d'un finder : inclusions + exclusions. Sortie unique en DSL,
 * consommée à l'identique par les DEUX chemins de recherche du finder
 * (`getEligiblePlaces` liste collaborative ET `searchCostum` modale/`FinderField`).
 *
 * Sémantique :
 * - **Inclusions** groupées par `attributeName` → scalaire si une seule valeur,
 *   sinon `{ $in: [...] }` (n'importe laquelle matche).
 * - **Exclusions** groupées par `attributeName` → `{ $nin: [...] }`.
 *
 * ⚠️ Gotchas du DSL backend (`SearchNew::searchFilters`, cf. mémoire
 * `search-filters-backend-dsl`) :
 * - Il ne combine PAS `$in`+`$nin` sur une même clé (le `$nin` l'emporte, la
 *   contrainte positive est perdue). Donc quand un attribut porte À LA FOIS une
 *   inclusion et une exclusion (cas réel : `tags` = `TiersLieux` inclus +
 *   `RéseauTiersLieux` exclu), on **relocalise l'inclusion sous `$or`** (clause
 *   mono-**OBJET** — un tableau ferait crasher Mongo « entries need to be full
 *   objects ») et on garde le `$nin` sur la clé. Idiome prouvé (vérifié en base :
 *   4303 lieux, 0 réseau) repris des sections search de la config tiers-lieux.
 * - `$nin` sur `tags` = match EXACT → retire aussi les réseaux double-taggés
 *   `TiersLieux`+`RéseauTiersLieux`.
 *
 * Sans exclusion, la sortie est identique au comportement historique
 * (scalaire / `$in`), donc zéro régression sur les finders sans exclusion.
 */
export function buildFinderMongoFilters(
  include: FinderFilter[],
  exclude: FinderFilter[] = [],
): Record<string, unknown> {
  const groupBy = (filters: FinderFilter[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const f of filters) {
      const arr = map.get(f.attributeName) ?? [];
      arr.push(f.valueName);
      map.set(f.attributeName, arr);
    }
    return map;
  };

  const includeGroups = groupBy(include);
  const excludeGroups = groupBy(exclude);

  const out: Record<string, unknown> = {};
  const orClause: Record<string, unknown> = {};

  for (const [attr, values] of includeGroups) {
    if (excludeGroups.has(attr)) {
      // Collision inclusion+exclusion sur le même attribut → l'inclusion passe
      // sous $or (forme $in, alignée sur l'idiome prouvé de la config tiers-lieux).
      // ⚠️ Hypothèse : UNE SEULE collision (cas réel = `tags`). `$or` étant un
      // OBJET mono-niveau, si ≥2 attributs collidaient simultanément, leurs
      // inclusions fusionneraient sous un même `$or` → sémantique OR (au lieu de
      // AND) côté backend. Non supporté par le DSL (searchFilters n'accepte
      // qu'un `$or`-objet) et non requis par les finders réels.
      orClause[attr] = { $in: values };
    } else {
      out[attr] = values.length === 1 ? values[0] : { $in: values };
    }
  }

  for (const [attr, values] of excludeGroups) {
    out[attr] = { $nin: values };
  }

  if (Object.keys(orClause).length > 0) {
    out.$or = orClause;
  }

  return out;
}

/**
 * Natures de lieux d'un dispositif « par lieu » (form d'usage à réponse
 * partagée) : pilotent les libellés ET, par défaut, le périmètre des listes de
 * lieux. Source UNIQUE des `z.enum` de config (`toolsCatalog`, `aac.detail`).
 * Absent ⇒ `tiersLieu`, le dispositif historique.
 */
export const PLACE_KINDS = ["tiersLieu", "cae"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

/**
 * Périmètre PAR DÉFAUT de chaque nature de lieu : les costums dont les
 * organisations relèvent. Le serveur borne à
 * `$or[source.keys ∈, reference.costum ∈]` (`SearchNew::buildSourceKey`).
 *
 * Une source ajoutée ici vaut pour TOUS les sites de cette nature ; pour un seul
 * site, la config déclare `placeSourceKeys` (cf. `placeKindSourceKeys`).
 */
export const PLACE_KIND_SOURCE_KEYS: Record<PlaceKind, readonly string[]> = {
  cae: ["federationDesCae"],
  tiersLieu: ["franceTierslieux"],
};

/**
 * Clés de source du périmètre des lieux : la surcharge de config
 * (`placeSourceKeys`) si elle porte au moins une clé, sinon le préréglage de
 * `kind` (défaut : tiers-lieux).
 *
 * Défensif sur les DEUX entrées : la config n'est pas parsée au runtime (les
 * props arrivent brutes du JSON). Une surcharge est donc nettoyée (non-chaînes et
 * chaînes vides écartées), et une nature inconnue retombe sur tiers-lieux au lieu
 * de planter sur un préréglage `undefined`.
 */
export function placeKindSourceKeys(kind?: PlaceKind, override?: readonly unknown[]): string[] {
  const surcharge = Array.isArray(override)
    ? override.filter((k): k is string => typeof k === "string" && k.trim() !== "")
    : [];
  if (surcharge.length > 0) return surcharge;
  const nature: PlaceKind = kind && (PLACE_KINDS as readonly string[]).includes(kind) ? kind : "tiersLieu";
  return [...PLACE_KIND_SOURCE_KEYS[nature]];
}

/** Paramètres `searchCostum` qu'un finder impose à la recherche d'éléments. */
export interface FinderSearchParams {
  searchType: FinderElementType[];
  filters?: Record<string, unknown>;
  notSourceKey?: true;
  sourceKey?: string[];
}

/**
 * Paramètres de recherche `searchCostum` d'un finder : type(s) cherché(s),
 * filtres DSL (inclusions + exclusions, via `buildFinderMongoFilters`) et
 * périmètre. Source UNIQUE pour tout écran qui propose « les éléments de ce
 * finder » — la modale de recherche (`useFinderSearchResults`) comme la liste
 * « J'utilise » de la fiche commun, qui doivent rester strictement alignées.
 *
 * - `filters` est OMIS quand le finder n'en déclare aucun (pas de `filters: {}`).
 * - Périmètre : un `sourceKey` non vide l'emporte — il est émis tel quel et
 *   `notSourceKey` est alors OMIS (sa seule présence désarmerait le périmètre).
 * - Sans `sourceKey`, `notSourceKey` n'est posé qu'à `true`. Absent, le SDK borne
 *   la recherche au costum courant (`_withCostumContext`) ; un `false` partirait
 *   en chaîne `"false"` (form-urlencoded), que la garde serveur `empty()` lit
 *   comme ACTIF — il ferait donc exactement l'inverse de ce qu'il dit.
 */
export function buildFinderSearchParams(
  finder: Pick<FinderConfig, "filters" | "excludeFilters" | "notSourceKey" | "sourceKey"> & {
    type: FinderElementType | FinderElementType[];
  },
): FinderSearchParams {
  const filters = buildFinderMongoFilters(finder.filters ?? [], finder.excludeFilters ?? []);
  const scope: Pick<FinderSearchParams, "notSourceKey" | "sourceKey"> = finder.sourceKey?.length
    ? { sourceKey: [...finder.sourceKey] }
    : finder.notSourceKey
      ? { notSourceKey: true }
      : {};
  return {
    searchType: Array.isArray(finder.type) ? finder.type : [finder.type],
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...scope,
  };
}

/**
 * Le type d'un finder là où il n'en faut qu'UN : type de repli d'un résultat, formulaire du bouton
 * « Ajouter ». Le typage de `FinderConfig.type` dit une chaîne, mais la donnée n'y est pas tenue
 * (`params.type` est lu tel quel) : d'une LISTE, on prend le premier. Convention d'ici — l'écran de
 * config du legacy n'enregistre qu'un type.
 */
export function primaryFinderType(type: FinderElementType | FinderElementType[]): FinderElementType {
  return Array.isArray(type) ? type[0] : type;
}
