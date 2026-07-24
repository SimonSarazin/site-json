import type { AgendaTab } from "../schema";

/**
 * Sérialisation des filtres agenda dans l'URL (partage/bookmark/retour navigateur) — fonctions PURES
 * et testables, dans l'esprit de `computeFiltersFromUrl`/`computeUrlFromFilters` (search). Le `vue`/`tab`
 * ne sont écrits que s'ils diffèrent du défaut (URL propre) ; `q`/`type`/`tags` s'ils sont renseignés.
 */
export type AgendaMode = "list" | "calendar" | "map";

export interface AgendaFilterState {
  mode: AgendaMode;
  tab: AgendaTab;
  text: string;
  type: string;
  tags: string[];
}

export interface AgendaFilterDefaults {
  mode: AgendaMode;
  tab: AgendaTab;
  tabs: AgendaTab[];
}

/** Noms des paramètres d'URL agenda. */
export const AGENDA_URL_PARAMS = { mode: "vue", tab: "tab", text: "q", type: "type", tags: "tags" } as const;

/** Lit l'état des filtres depuis l'URL (avec repli sur les défauts de la section). */
export function readAgendaUrl(sp: URLSearchParams, d: AgendaFilterDefaults): AgendaFilterState {
  const modeRaw = sp.get(AGENDA_URL_PARAMS.mode);
  const mode = modeRaw === "calendar" || modeRaw === "list" || modeRaw === "map" ? modeRaw : d.mode;

  const tabRaw = sp.get(AGENDA_URL_PARAMS.tab) as AgendaTab | null;
  const tab = tabRaw && d.tabs.includes(tabRaw) ? tabRaw : d.tab;

  const tags = (sp.get(AGENDA_URL_PARAMS.tags) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    mode,
    tab,
    text: sp.get(AGENDA_URL_PARAMS.text) ?? "",
    type: sp.get(AGENDA_URL_PARAMS.type) ?? "",
    tags,
  };
}

/**
 * Projette l'état des filtres dans l'URL (préserve les autres paramètres).
 * `manage` = par param, l'agenda POSSÈDE-t-il ce filtre (true = il gère le param URL). Un param non
 * possédé (`false`) N'EST PAS TOUCHÉ : le filtre est délégué à un `searchHeader` sœur (qui possède le
 * param + le PageFilters) → évite que les deux écrivains se battent sur la même clé (cf. Agenda avec
 * `filters.{text,type,tags}:false`). `mode`/`tab` sont TOUJOURS propres à l'agenda. Défaut : tout géré.
 */
export function writeAgendaUrl(
  sp: URLSearchParams,
  s: AgendaFilterState,
  d: AgendaFilterDefaults,
  manage: { text?: boolean; type?: boolean; tags?: boolean } = {},
): URLSearchParams {
  const { text: mText = true, type: mType = true, tags: mTags = true } = manage;
  const next = new URLSearchParams(sp);
  const apply = (key: string, value: string, keep: boolean) => {
    if (keep && value) next.set(key, value);
    else next.delete(key);
  };
  apply(AGENDA_URL_PARAMS.mode, s.mode, s.mode !== d.mode);
  apply(AGENDA_URL_PARAMS.tab, s.tab, s.tab !== d.tab);
  if (mText) apply(AGENDA_URL_PARAMS.text, s.text.trim(), s.text.trim().length > 0);
  if (mType) apply(AGENDA_URL_PARAMS.type, s.type, s.type.length > 0);
  if (mTags) apply(AGENDA_URL_PARAMS.tags, s.tags.join(","), s.tags.length > 0);
  return next;
}
