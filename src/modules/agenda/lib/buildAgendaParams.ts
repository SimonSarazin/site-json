/**
 * Source UNIQUE des paramètres passés à `entity.searchEventsCostum` — pendant agenda de
 * `buildSearchPayload` (search). Hooks client (`useAgendaCalendar`/`useAgendaList`) construisent le
 * payload ICI, pour garantir l'unité (mêmes filtres/scope, même forme). Le `baseParams` de la section
 * (même convention que searchProStatic) y est fusionné : `sourceKey` (multi-sources), `indexStepList`,
 * `fediverse`, `filters`, `locality`. Sans `sourceKey`, le SDK auto-scope au costum courant
 * (`_withCostumContext`). NON repris (non supportés par searchEventsCostum) : `defaultFields`/
 * `defaultSortBy` (tri par occurrence interne) et `defaultTypes` (forcé à `["events"]`).
 */

import { applyValidationGate } from "@/modules/search/lib/validationGate";

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
   * Slug du costum pour la PORTE DE VALIDATION : à `"monSite"`, les événements EN ATTENTE
   * (`preferences.toBeValidated.monSite` / `source.toBeValidated.monSite`) sont masqués — même
   * sémantique que `baseParams.costumSlug` d'un `searchProStatic`.
   *
   * ⚠ N'est PAS émis dans le payload : le SDK injecte déjà son propre `costumSlug` via
   * `_withCostumContext`. La clé ne sert QUE de source au filtre client — comme dans `searchCostum`,
   * où le backend Node est stateless et le legacy non déterministe.
   *
   * Sans elle, aucune porte : un événement proposé par un formulaire costum injectant
   * `preferences.toBeValidated` s'affiche publiquement dès sa création (défaut mesuré, commit e3f1a060).
   */
  costumSlug?: string;
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
  // `searchEventsCostum` ne passe PAS par `buildSearchPayload` : la porte doit être appelée ici,
  // sinon elle n'existe pas pour l'agenda. `types` est constant — l'agenda ne cherche que des events.
  const filters = applyValidationGate(bp.filters, { costumSlug: bp.costumSlug, types: ["events"] });
  return {
    ...(bp.sourceKey && bp.sourceKey.length ? { sourceKey: bp.sourceKey } : {}),
    ...(bp.fediverse !== undefined ? { fediverse: bp.fediverse } : {}),
    ...(filters && Object.keys(filters).length > 0 ? { filters } : {}),
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
  // `cs` est indispensable : la porte de validation dérive de `costumSlug` et modifie les `filters`
  // ÉMIS sans toucher à `bp.filters` — sans lui, deux périmètres distincts partageraient un cache.
  return JSON.stringify(sortKeys({ s: bp.sourceKey ?? null, cs: bp.costumSlug ?? null, f: bp.fediverse ?? null, fl: bp.filters ?? null, l: bp.locality ?? null }));
}
