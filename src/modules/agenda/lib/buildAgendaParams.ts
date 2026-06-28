/**
 * Source UNIQUE des paramètres passés à `entity.searchEventsCostum` — pendant agenda de
 * `buildSearchPayload` (search). Hooks client (`useAgendaCalendar`/`useAgendaList`) ET prefetch SSR
 * (`prefetchAgenda`) construisent le payload ICI, pour garantir l'unité (mêmes filtres, même forme
 * → même périmètre fetché SSR vs hydraté). Le scope costum est injecté AUTOMATIQUEMENT par le SDK
 * via le contexte de l'entité (`_withCostumContext`, sourceKey=[slug]) — ne pas le passer à la main.
 */

/** Filtres backend communs aux deux modes (scalaires, comme l'attend le SDK). */
export interface AgendaParamsInput {
  /** Type d'event (mono-select côté SDK). */
  type?: string;
  /** Recherche texte (name). */
  name?: string;
}

type AgendaCalendarParams = {
  startDateUTC: Date;
  endDateUTC: Date;
  type?: string;
  name?: string;
};

type AgendaListParams = {
  indexStep: number;
  type?: string;
  name?: string;
};

/** Mode CALENDRIER : bornes de plage (récurrents dépliés, une page) + filtres. */
export function buildAgendaCalendarParams(
  rangeStart: Date,
  rangeEnd: Date,
  input: AgendaParamsInput = {},
): AgendaCalendarParams {
  return {
    startDateUTC: rangeStart,
    endDateUTC: rangeEnd,
    ...(input.type ? { type: input.type } : {}),
    ...(input.name ? { name: input.name } : {}),
  };
}

/** Mode LISTE : pas de dates (ponctuels, DESC, paginé) + filtres. */
export function buildAgendaListParams(indexStep: number, input: AgendaParamsInput = {}): AgendaListParams {
  return {
    indexStep,
    ...(input.type ? { type: input.type } : {}),
    ...(input.name ? { name: input.name } : {}),
  };
}
