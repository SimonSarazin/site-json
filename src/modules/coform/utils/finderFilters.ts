import type { FinderFilter } from "../types";

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
