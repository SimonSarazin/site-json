import type { SearchByFieldValue } from "../contexts/pageFilters";

/**
 * Forme minimale d'un groupe de filtres (sous-ensemble de `FiltersSectionProps`).
 */
export interface FilterGroupLike {
  id: string;
  type?: string;
  filterType?: string;
  /** scopeList (zones) : clé de `locality`. Défaut `${option.id}${option.level}`. */
  field?: string;
  options?: Array<{ id: string; name?: string; level?: string }>;
}

/** Données `filtersByAnswers`/`filtersByPath` résolues (services → orgaNameArray). */
export type FilterAnswerDataLike =
  | Record<string, { values: Record<string, { name?: string; orgaNameArray?: string[] }> }>
  | null
  | undefined;

/**
 * Traduit les query params d'URL en mutations de l'état `PageFilters`, **à
 * l'identique de `FiltersSection`** (typologies → `selectedFilters` ; services
 * form-based → `searchByFields[_id]` via `orgaNameArray` ; entityList → sourceKey).
 *
 * Source unique réutilisée par `FiltersSection` (UI `/lieux`) **et** l'applicateur
 * headless de la home → mêmes filtres, mêmes résultats. Renvoie deux fonctions de
 * merge (qui préservent les clés non gérées) à passer à `setSelectedFilters` /
 * `setSearchByFields`.
 */
export function computeFiltersFromUrl(
  searchParams: URLSearchParams,
  filterGroups: FilterGroupLike[],
  filterAnswerData: FilterAnswerDataLike,
): {
  applySelected: (prev: Record<string, string[]>) => Record<string, string[]>;
  applySearchFields: (prev: Record<string, SearchByFieldValue>) => Record<string, SearchByFieldValue>;
} {
  const nextSelected: Record<string, string[]> = {};
  const nextSearchFields: Record<string, SearchByFieldValue> = {};

  const managedFilterGroupIds = new Set(filterGroups.map((g) => g.id));
  const managedAnswerOptionKeys = new Set<string>();
  Object.values(filterAnswerData ?? {}).forEach((g) => {
    Object.keys(g.values).forEach((k) => managedAnswerOptionKeys.add(k));
  });
  // Clés searchByFields gérées par les groupes entityList / scopeList (= leurs
  // options) → reconstruites depuis l'URL plutôt que préservées.
  const managedEntityOptionKeys = new Set<string>();
  const managedScopeOptionKeys = new Set<string>();
  filterGroups.forEach((g) => {
    if (g.type === "entityList") {
      (g.options ?? []).forEach((o) => managedEntityOptionKeys.add(o.name || o.id));
    } else if (g.type === "scopeList") {
      (g.options ?? []).forEach((o) => managedScopeOptionKeys.add(o.name || o.id));
    }
  });

  searchParams.forEach((rawValue, groupId) => {
    const values = rawValue.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) return;

    const group = filterGroups.find((g) => g.id === groupId);
    if (group) {
      // entityList → searchByFields (type sourceKey), comme le toggle manuel.
      if (group.type === "entityList") {
        const fType = group.filterType ?? "sourceKey";
        values.forEach((v) => {
          const opt = (group.options ?? []).find((o) => (o.name || o.id) === v || o.id === v);
          const slug = opt ? opt.name || opt.id : null;
          if (slug) {
            nextSearchFields[slug] = { field: fType, type: fType, value: [slug] };
          }
        });
        return;
      }
      // scopeList (zones : pays / régions) → searchByFields (type scopeList,
      // encodage `{ id, type: level }` → locality), à l'identique du clic. Sans
      // ça, un deep-link `?regions=…` partait en `selectedFilters` → envoyé comme
      // TAG au lieu de filtre de localité.
      if (group.type === "scopeList") {
        values.forEach((v) => {
          const opt = (group.options ?? []).find((o) => (o.name || o.id) === v || o.id === v);
          if (!opt || !opt.level) return;
          const key = opt.name || opt.id;
          const field = group.field ?? `${opt.id}${opt.level}`;
          nextSearchFields[key] = {
            field,
            type: "scopeList",
            value: { id: key, type: opt.level },
          };
        });
        return;
      }
      const matchedNames = values
        .map((v) => {
          const opt = (group.options ?? []).find((o) => (o.name || o.id) === v || o.id === v);
          return opt ? opt.name || opt.id : null;
        })
        .filter((n): n is string => n !== null);
      if (matchedNames.length > 0) {
        nextSelected[groupId] = matchedNames;
      }
      return;
    }

    const answerGroup = filterAnswerData?.[groupId];
    if (answerGroup) {
      values.forEach((v) => {
        const optionEntry = Object.entries(answerGroup.values).find(
          ([key, val]) => key === v || val.name === v,
        );
        if (optionEntry) {
          const [optionKey, optionValue] = optionEntry;
          nextSearchFields[optionKey] = {
            field: "_id",
            value: (optionValue.orgaNameArray ?? []) as string[],
          };
        }
      });
    }
  });

  return {
    applySelected: (prev) => {
      const preserved: Record<string, string[]> = {};
      Object.entries(prev).forEach(([gid, arr]) => {
        if (!managedFilterGroupIds.has(gid)) preserved[gid] = arr;
      });
      return { ...preserved, ...nextSelected };
    },
    applySearchFields: (prev) => {
      const preserved: Record<string, SearchByFieldValue> = {};
      Object.entries(prev).forEach(([key, val]) => {
        if (
          !managedAnswerOptionKeys.has(key) &&
          !managedEntityOptionKeys.has(key) &&
          !managedScopeOptionKeys.has(key)
        )
          preserved[key] = val;
      });
      return { ...preserved, ...nextSearchFields };
    },
  };
}
