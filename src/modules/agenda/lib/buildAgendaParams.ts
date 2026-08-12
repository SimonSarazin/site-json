/**
 * Source UNIQUE des paramètres passés à `entity.searchEventsCostum` — pendant agenda de
 * `buildSearchPayload` (search). Hooks client (`useAgendaCalendar`/`useAgendaList`) construisent le
 * payload ICI, pour garantir l'unité (mêmes filtres/scope, même forme). Le `baseParams` de la section
 * (même convention que searchProStatic) y est fusionné : `sourceKey` (multi-sources), `indexStepList`,
 * `fediverse`, `filters`, `locality`. Sans `sourceKey`, le SDK auto-scope au costum courant
 * (`_withCostumContext`). NON repris (non supportés par searchEventsCostum) : `defaultFields`/
 * `defaultSortBy` (tri par occurrence interne) et `defaultTypes` (forcé à `["events"]`).
 */

/** Filtres backend communs aux deux modes (scalaires, comme l'attend le SDK). */
export interface AgendaParamsInput {
  /** Type d'event (mono-select côté SDK). */
  type?: string;
  /** Recherche texte (name). */
  name?: string;
}

/** Sous-ensemble de `baseParams` (config section, même convention que search) supporté par searchEventsCostum. */
export interface AgendaBaseParams {
  /** Scope multi-sources (filtre `source.keys`). Vide → costum courant (auto SDK). */
  sourceKey?: string[];
  /**
   * Désactive le périmètre costum, comme `searchProStatic.baseParams.notSourceKey` (la garde
   * serveur est un `empty()` : PRÉSENTE, quelle que soit sa valeur, la clé désactive le filtrage).
   * Nécessaire quand les events du réseau lui sont rattachés par LIEN et non par provenance :
   * le scope costum, intersecté avec un filtre sur `links.*`, donne sinon un ensemble vide.
   */
  notSourceKey?: boolean;
  /** Pas de pagination de la vue LISTE (aligne `indexStepList` de search). */
  indexStepList?: number;
  /** Inclure les sources fédiverse. */
  fediverse?: boolean;
  /** Filtres backend bruts (mongo). */
  filters?: Record<string, unknown>;
  /** Localités ciblées. */
  locality?: Record<string, unknown>;
}

export const AGENDA_DEFAULT_INDEX_STEP = 20;

/** Champs de scope/filtre issus de baseParams, communs aux deux modes. */
function fromBaseParams(bp?: AgendaBaseParams): Record<string, unknown> {
  if (!bp) return {};
  return {
    ...(bp.sourceKey && bp.sourceKey.length ? { sourceKey: bp.sourceKey } : {}),
    ...(bp.notSourceKey ? { notSourceKey: true } : {}),
    ...(bp.fediverse !== undefined ? { fediverse: bp.fediverse } : {}),
    ...(bp.filters ? { filters: bp.filters } : {}),
    ...(bp.locality ? { locality: bp.locality } : {}),
  };
}

/** Pas de pagination de la liste (baseParams.indexStepList sinon défaut). */
export function agendaListIndexStep(bp?: AgendaBaseParams): number {
  return bp?.indexStepList ?? AGENDA_DEFAULT_INDEX_STEP;
}

/** Mode CALENDRIER : bornes de plage (récurrents dépliés, une page) + scope/filtres. */
export function buildAgendaCalendarParams(
  rangeStart: Date,
  rangeEnd: Date,
  input: AgendaParamsInput = {},
  baseParams?: AgendaBaseParams,
): Record<string, unknown> {
  return {
    startDateUTC: rangeStart,
    endDateUTC: rangeEnd,
    ...fromBaseParams(baseParams),
    ...(input.type ? { type: input.type } : {}),
    ...(input.name ? { name: input.name } : {}),
  };
}

/** Mode LISTE : pas de dates (ponctuels, DESC, paginé) + scope/filtres. */
export function buildAgendaListParams(
  indexStep: number,
  input: AgendaParamsInput = {},
  baseParams?: AgendaBaseParams,
): Record<string, unknown> {
  return {
    indexStep,
    ...fromBaseParams(baseParams),
    ...(input.type ? { type: input.type } : {}),
    ...(input.name ? { name: input.name } : {}),
  };
}

/** Tri récursif des clés d'objet → JSON.stringify CANONIQUE : deux `filters` logiquement identiques mais
 *  d'ordre d'insertion différent (ex. facette theme→public vs public→theme) donnent la MÊME signature →
 *  pas de cache-miss / refetch redondant. (L'ordre des tableaux est préservé : sourceKey/$in restent tels quels.) */
function sortKeys(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === "object") {
    return Object.fromEntries(
      Object.keys(o as object)
        .sort()
        .map((k) => [k, sortKeys((o as Record<string, unknown>)[k])]),
    );
  }
  return o;
}

/** Signature stable de baseParams pour la queryKey (scope/filtres affectant les résultats). Canonique. */
export function agendaBaseSig(bp?: AgendaBaseParams): string {
  if (!bp) return "";
  return JSON.stringify(sortKeys({ s: bp.sourceKey ?? null, f: bp.fediverse ?? null, fl: bp.filters ?? null, l: bp.locality ?? null }));
}
