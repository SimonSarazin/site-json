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

/**
 * Bornes et tri du mode LISTE — paramètres OPTIONNELS de `/co2/search/agenda` (legacy 2026-09-04,
 * miroir Node ; cf. lib `searchEventsCostum`). Sans eux le serveur répond comme avant : DESC non
 * borné, la 1re page = les events les plus LOINTAINS. Dès qu'un des trois est présent, chaque ligne
 * porte `endDateSortFormat` (fin d'occurrence calculée serveur, fuseau de l'event).
 */
export interface AgendaListBounds {
  /**
   * Borne basse « pas encore terminé à from » (un multi-jours ou un créneau en cours reste servi) ET
   * ANCRE de la pagination : `next()` rejoue la même valeur, la clé de tri des récurrents ne bouge
   * pas entre deux pages. Passer un instant FIGÉ (`useAgendaClock`), jamais `new Date()` au render.
   */
  from?: Date;
  /** Borne haute STRICTE sur la clé d'occurrence. */
  to?: Date;
  /** Sens du tri sur la clé d'occurrence (défaut serveur : desc). */
  order?: "asc" | "desc";
  /** `false` = sans récurrent (mode « passés » : une série n'a pas de passé). */
  recurrency?: boolean;
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
   *
   * ⚠ DÉSARME aussi `costumSlug` ci-dessous : sans costum de scope, il n'y a pas de slug sous
   * lequel indexer `toBeValidated`. Les deux clés ensemble = pas de porte.
   */
  notSourceKey?: boolean;
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
  /** Taille de page de chaque flux LISTE (aligne `indexStepList` de search). */
  indexStepList?: number;
  /**
   * Inclure les événements RÉCURRENTS. Absent = inclus (défaut serveur). Émis dans les DEUX modes,
   * liste comme calendrier — sans quoi on les exclurait de la liste pour les voir revenir dans la
   * grille. Cf. la docstring de la clé de config dans `schema.ts`.
   */
  recurrency?: boolean;
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
  const filters = applyValidationGate(bp.filters, { costumSlug: bp.costumSlug, notSourceKey: bp.notSourceKey, types: ["events"] });
  return {
    ...(bp.sourceKey && bp.sourceKey.length ? { sourceKey: bp.sourceKey } : {}),
    ...(bp.notSourceKey ? { notSourceKey: true } : {}),
    // Non émis quand la config l'omet : l'absence de clé VAUT « inclus » côté serveur, et émettre
    // `true` par défaut ferait basculer la réponse dans le régime borné pour rien.
    ...(bp.recurrency !== undefined ? { recurrency: bp.recurrency } : {}),
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

/**
 * Mode LISTE : sans `startDateUTC`/`endDateUTC` (une ligne par event, récurrents compris, paginé) +
 * scope/filtres + bornes/tri serveur (`from`/`to`/`order`/`recurrency`, cf. `AgendaListBounds`).
 * Les dates partent en ISO AVEC offset (`toISOString`) : une date nue serait lue en Europe/Paris par
 * le legacy et en UTC par le backend Node.
 *
 * PRÉCÉDENCE de `recurrency` : les bornes sont étalées APRÈS `baseParams`, donc le `false` du flux
 * « Passés » l'emporte sur une config qui les inclurait. C'est voulu — cette exclusion-là n'est pas
 * une préférence de site mais une contrainte de sens (une série n'a pas de passé).
 */
export function buildAgendaListParams(
  indexStep: number,
  input: AgendaParamsInput = {},
  baseParams?: AgendaBaseParams,
  bounds?: AgendaListBounds,
): Record<string, unknown> {
  return {
    indexStep,
    ...fromBaseParams(baseParams),
    ...(input.type ? { type: input.type } : {}),
    ...(input.name ? { name: input.name } : {}),
    ...(bounds?.from ? { from: bounds.from.toISOString() } : {}),
    ...(bounds?.to ? { to: bounds.to.toISOString() } : {}),
    ...(bounds?.order ? { order: bounds.order } : {}),
    ...(bounds?.recurrency !== undefined ? { recurrency: bounds.recurrency } : {}),
  };
}

/** Signature stable des bornes pour la queryKey (deux flux, deux ancres → deux caches). */
export function agendaBoundsSig(b?: AgendaListBounds): string {
  if (!b) return "";
  return JSON.stringify({ f: b.from?.toISOString() ?? null, t: b.to?.toISOString() ?? null, o: b.order ?? null, r: b.recurrency ?? null });
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
  // RÈGLE : toute clé de `baseParams` qui change le payload ÉMIS doit figurer ici.
  //  · `cs` — la porte de validation dérive de `costumSlug` et modifie les `filters` émis sans
  //    toucher à `bp.filters` ; sans lui, deux périmètres distincts partagent un cache.
  //  · `n`  — `notSourceKey` est émis tel quel ET désarme la porte : deux agendas ne différant que
  //    par lui interrogent des ensembles disjoints (périmètre costum vs réseau entier).
  //  · `r`  — `recurrency` est émis tel quel dans les deux modes : deux agendas ne différant que par
  //    lui interrogent des ensembles distincts (avec ou sans les séries).
  return JSON.stringify(sortKeys({ s: bp.sourceKey ?? null, n: bp.notSourceKey ?? null, cs: bp.costumSlug ?? null, r: bp.recurrency ?? null, f: bp.fediverse ?? null, fl: bp.filters ?? null, l: bp.locality ?? null }));
}
