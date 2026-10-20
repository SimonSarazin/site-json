/**
 * Gestes de filtrage de l'annuaire (fonctions pures), partagés par toutes les dispositions :
 * une disposition choisit la présentation, pas l'effet d'un clic.
 */
import type { AacDirectoryFiltersState, AacSortKey } from "./filtersKey";
import { EMPTY_AAC_FILTERS } from "./filtersKey";
import type { AacUsageOption } from "./aacUsage";
import type { AacCardFieldRef } from "./resolveAacCardFields";

/** Une option cochable : identifiant, libellé, et décompte facultatif. */
export interface AacFacetOption {
  id: string;
  label: string;
  count?: number;
}

/** Ajoute la valeur si elle est absente, la retire sinon. */
export function toggleIn(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Coche ou décoche une catégorie d'usage. Les sous-catégories des catégories retirées sont
 * décochées, sauf si plus aucune catégorie n'est retenue (« Tous » les réaffiche toutes).
 */
export function toggleUsageCategory(
  filters: AacDirectoryFiltersState,
  usageTree: readonly AacUsageOption[],
  id: string
): AacDirectoryFiltersState {
  const nextUsage = toggleIn(filters.usage, id);
  return {
    ...filters,
    usage: nextUsage,
    usageSub:
      nextUsage.length === 0
        ? filters.usageSub
        : filters.usageSub.filter((subId) =>
            usageTree
              .filter((c) => nextUsage.includes(c.id))
              .some((c) => c.children.some((s) => s.id === subId))
          ),
  };
}

/** Sous-catégories des seules catégories retenues — « Tous » = toutes. */
export function visibleUsageSubs(
  usageTree: readonly AacUsageOption[],
  selectedUsage: readonly string[]
): AacUsageOption[] {
  return usageTree
    .filter((c) => selectedUsage.length === 0 || selectedUsage.includes(c.id))
    .flatMap((c) => c.children);
}

/** Les options de la question « Utilisable », telles que le formulaire les nomme. */
export function maturityOptionsOf(field: AacCardFieldRef | null): AacFacetOption[] {
  return (field?.options ?? []).map((o) => ({ id: o.value, label: o.label }));
}

/** Un seul tri à la fois : re-choisir le tri actif le retire et rend l'ordre du serveur. */
export function toggleSort(filters: AacDirectoryFiltersState, key: AacSortKey): AacDirectoryFiltersState {
  return { ...filters, sort: filters.sort === key ? "" : key };
}

/** Tous les filtres à zéro — recherche comprise. */
export function resetFilters(): AacDirectoryFiltersState {
  return { ...EMPTY_AAC_FILTERS, tags: [], maturity: [], commune: [], usage: [], usageSub: [] };
}
