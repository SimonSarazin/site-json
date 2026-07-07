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
  options?: Array<{
    id: string;
    name?: string;
    level?: string;
    /** searchTargets : cible (defaultTypes/defaultFilters) portée par l'option. */
    target?: Record<string, unknown>;
    /** searchTargets : option pré-sélectionnée (cf. applyDefaultSearchTargets). */
    defaultChecked?: boolean;
  }>;
}

/**
 * Applique la sélection PAR DÉFAUT des groupes `searchTargets` (option
 * `defaultChecked`) dans `searchByFields` — jamais dans `selectedFilters` :
 * une cible rangée en `selectedFilters` fuirait en TAG `$all` inexistant
 * (`typeinfo-…`) et viderait la recherche.
 *
 * L'URL prime : pas de défaut si le param du groupe est présent, ni si une
 * option du groupe est déjà sélectionnée. À n'appeler qu'à l'hydratation
 * initiale (pas au back/forward : une URL sans param y signifie « décoché »).
 */
export function applyDefaultSearchTargets(
  prev: Record<string, SearchByFieldValue>,
  filterGroups: FilterGroupLike[],
  searchParams: URLSearchParams,
): Record<string, SearchByFieldValue> {
  let next = prev;
  for (const group of filterGroups) {
    const isSearchTargets = group.type === "searchTargets";
    const isField = !!group.field;
    // Seuls les groupes searchTargets et « champ » posent leur défaut dans
    // searchByFields ; les groupes « tag » gardent le leur en selectedFilters.
    if (!isSearchTargets && !isField) continue;
    if (searchParams.has(group.id)) continue;
    const optionKeys = (group.options ?? []).map((o) => o.name || o.id);
    if (optionKeys.some((k) => Object.prototype.hasOwnProperty.call(next, k))) continue;
    const def = (group.options ?? []).find((o) => o.defaultChecked);
    if (!def) continue;
    const key = def.name || def.id;
    next = {
      ...next,
      [key]: isSearchTargets
        ? { field: "searchTarget", type: "searchTarget", value: def.target ?? {} }
        // Groupe « champ » : même forme qu'un clic (cf. lecture URL du groupe
        // `field`) → `{ <champ>: { $in: [key] } }` via searchByFieldsToQuery.
        : ({ field: group.field as string, value: [key] } as SearchByFieldValue),
    };
  }
  return next;
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
  // Clés searchByFields gérées par les groupes entityList / scopeList /
  // searchTargets (= leurs options) → reconstruites depuis l'URL plutôt que
  // préservées.
  const managedEntityOptionKeys = new Set<string>();
  const managedScopeOptionKeys = new Set<string>();
  const managedTargetOptionKeys = new Set<string>();
  filterGroups.forEach((g) => {
    if (g.type === "entityList") {
      (g.options ?? []).forEach((o) => managedEntityOptionKeys.add(o.name || o.id));
    } else if (g.type === "scopeList") {
      (g.options ?? []).forEach((o) => managedScopeOptionKeys.add(o.name || o.id));
    } else if (g.type === "searchTargets") {
      (g.options ?? []).forEach((o) => managedTargetOptionKeys.add(o.name || o.id));
    } else if (g.type === "dateRange") {
      // Clé searchByFields = id du groupe (une plage par groupe).
      managedTargetOptionKeys.add(g.id);
    } else if (g.field) {
      // Groupe « champ » (taxonomie en champs : parent62) → searchByFields,
      // clé = nom d'option, comme entityList/scopeList.
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
      // dateRange → searchByFields sous la clé du groupe : `?dates=2026-07-01`
      // (borne début), `?dates=2026-07-01,2026-08-31` (début,fin) ou
      // `?dates=,2026-08-31` (fin seule). On lit `rawValue` (et non `values`
      // filtré) pour préserver la position de début vide : sans ça une borne de
      // fin seule serait relue comme une borne de début.
      if (group.type === "dateRange") {
        const [start, end] = rawValue.split(",").map((v) => v.trim());
        nextSearchFields[group.id] = {
          field: group.field ?? "startDate",
          type: "dateRange",
          value: { ...(start ? { start } : {}), ...(end ? { end } : {}) },
        } as SearchByFieldValue;
        return;
      }
      // searchTargets (« type d'info ») → searchByFields, à l'identique du clic
      // (radio : seule la 1ʳᵉ valeur est prise) — deep-link `?typeInfo=paroles`.
      if (group.type === "searchTargets") {
        const opt = (group.options ?? []).find(
          (o) => (o.name || o.id) === values[0] || o.id === values[0],
        );
        if (opt) {
          nextSearchFields[opt.name || opt.id] = {
            field: "searchTarget",
            type: "searchTarget",
            value: opt.target ?? {},
          };
        }
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
      // Groupe « champ » : deep-link `?territoire=Arrageois` → searchByFields
      // → `{ territoires: { $in: ["Arrageois"] } }`, à l'identique du clic.
      if (group.field) {
        const field = group.field;
        values.forEach((v) => {
          const opt = (group.options ?? []).find((o) => (o.name || o.id) === v || o.id === v);
          if (!opt) return;
          const key = opt.name || opt.id;
          nextSearchFields[key] = { field, value: [key] };
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
          !managedScopeOptionKeys.has(key) &&
          !managedTargetOptionKeys.has(key)
        )
          preserved[key] = val;
      });
      return { ...preserved, ...nextSearchFields };
    },
  };
}
