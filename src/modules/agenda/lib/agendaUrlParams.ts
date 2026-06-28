import type { AgendaTab } from "../schema";

/**
 * Sérialisation des filtres agenda dans l'URL (partage/bookmark/retour navigateur) — fonctions PURES
 * et testables, dans l'esprit de `computeFiltersFromUrl`/`computeUrlFromFilters` (search). Le `vue`/`tab`
 * ne sont écrits que s'ils diffèrent du défaut (URL propre) ; `q`/`type`/`tags` s'ils sont renseignés.
 */
export interface AgendaFilterState {
  mode: "list" | "calendar";
  tab: AgendaTab;
  text: string;
  type: string;
  tags: string[];
}

export interface AgendaFilterDefaults {
  mode: "list" | "calendar";
  tab: AgendaTab;
  tabs: AgendaTab[];
}

/** Noms des paramètres d'URL agenda. */
export const AGENDA_URL_PARAMS = { mode: "vue", tab: "tab", text: "q", type: "type", tags: "tags" } as const;

/** Lit l'état des filtres depuis l'URL (avec repli sur les défauts de la section). */
export function readAgendaUrl(sp: URLSearchParams, d: AgendaFilterDefaults): AgendaFilterState {
  const modeRaw = sp.get(AGENDA_URL_PARAMS.mode);
  const mode = modeRaw === "calendar" || modeRaw === "list" ? modeRaw : d.mode;

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

/** Projette l'état des filtres dans l'URL (préserve les autres paramètres). */
export function writeAgendaUrl(
  sp: URLSearchParams,
  s: AgendaFilterState,
  d: AgendaFilterDefaults,
): URLSearchParams {
  const next = new URLSearchParams(sp);
  const apply = (key: string, value: string, keep: boolean) => {
    if (keep && value) next.set(key, value);
    else next.delete(key);
  };
  apply(AGENDA_URL_PARAMS.mode, s.mode, s.mode !== d.mode);
  apply(AGENDA_URL_PARAMS.tab, s.tab, s.tab !== d.tab);
  apply(AGENDA_URL_PARAMS.text, s.text.trim(), s.text.trim().length > 0);
  apply(AGENDA_URL_PARAMS.type, s.type, s.type.length > 0);
  apply(AGENDA_URL_PARAMS.tags, s.tags.join(","), s.tags.length > 0);
  return next;
}
