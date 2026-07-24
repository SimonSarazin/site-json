/**
 * Fns de spec COMMUNES aux costums (registre `specRegistries`, pas des transforms) — l'import (side-effect)
 * enregistre les clés partagées. Pendant de `sharedCodecs` mais pour les fns de modale (existingUrl, …).
 */
import type { QueryKey } from "@tanstack/react-query";
import { registerExistingUrlFn, registerCleanValuesFn, registerInvalidateFn, type InvalidateFn } from "../specRegistries";
import { PROFIL_QUERY_KEYS } from "../../constants";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants";
import { BLOG_QUERY_KEYS } from "@/modules/blog/constants/queryKeys";
import { AGENDA_QUERY_KEYS } from "@/modules/agenda/constants/queryKeys";

/** URL d'image existante GÉNÉRIQUE (clé `image:profilUrl`) : medium > image > thumb du serverData. Partagé par
 *  tous les costums (avant : enregistré à l'identique dans chaque `<entity>/fns`). */
registerExistingUrlFn("image:profilUrl", (entity) => {
  const sd = (entity as { serverData?: Record<string, unknown> }).serverData;
  return (sd?.profilMediumImageUrl || sd?.profilImageUrl || sd?.profilThumbImageUrl || undefined) as string | undefined;
});

/** cleanValues GÉNÉRIQUE PARAMÉTRÉ (clé `cleanValues:dropEmptyArrayItems`) : pour chaque champ array listé dans
 *  `params.fields`, retire les items vides (string vide/espaces). Ex-`poi:dropEmptyUrls` (params {fields:["urls"]}). */
registerCleanValuesFn("cleanValues:dropEmptyArrayItems", (values, params) => {
  const fields = (params?.fields as string[] | undefined) ?? [];
  const out = { ...values };
  for (const f of fields) {
    if (Array.isArray(out[f])) out[f] = (out[f] as unknown[]).filter((u) => String(u ?? "").trim().length > 0);
  }
  return out;
});

/** Builders « liste utilisateur » référençables par NOM (params.userList) — la fonction reste du code, le nom est data. */
const USER_LIST_BUILDERS: Record<string, (slug: string) => QueryKey> = {
  pois: PROFIL_QUERY_KEYS.USER_POIS_PREFIX,
  organizations: PROFIL_QUERY_KEYS.USER_ORGANIZATIONS_PREFIX,
  projects: PROFIL_QUERY_KEYS.USER_PROJECTS_PREFIX,
  events: PROFIL_QUERY_KEYS.USER_EVENTS_PREFIX,
};

/**
 * invalidate GÉNÉRIQUE PARAMÉTRÉ (clé `invalidate:standard`). params : `userList` (clé de USER_LIST_BUILDERS,
 * invalidée pour le parent/me en CRÉATION), `searchKeys` (préfixes de recherche à rafraîchir, 2 modes),
 * `parentAboutOnAdd` (rafraîchir l'about du parent en création). Édition → about de l'entité. Ex-poi/tl:invalidate.
 */
const standardInvalidate: InvalidateFn = (ctx, params) => {
  const searchKeys = ((params?.searchKeys as string[] | undefined) ?? []).map((k) => SEARCH_QUERY_KEYS.RESULTS_PREFIX(k));
  if (ctx.mode === "edit") {
    return [...(ctx.entity?.slug ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(ctx.entity.slug)] : []), ...searchKeys];
  }
  const target = ctx.parent ?? ctx.me;
  const builder = params?.userList ? USER_LIST_BUILDERS[params.userList as string] : undefined;
  return [
    ...(target && builder ? [builder(target.slug)] : []),
    ...(params?.parentAboutOnAdd && ctx.parent ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(ctx.parent.slug)] : []),
    ...searchKeys,
  ];
};
registerInvalidateFn("invalidate:standard", standardInvalidate);

/**
 * invalidate BLOG (clé `invalidate:blog`) = `invalidate:standard` (fil via `searchKeys`, about-par-slug en
 * édition, userList en création) + la clé détail PAR ID (`useArticle` byId — les ~82 % d'articles slugless
 * routés `/blog/id/:id`, NON couverts par l'about-par-slug). Mêmes params que standard (`userList`,
 * `searchKeys`). Sans ça, un article créé/édité via le form costum ne rafraîchit ni le fil ni son reader.
 */
registerInvalidateFn("invalidate:blog", (ctx, params) => {
  const byId = ctx.entity?.id ? [BLOG_QUERY_KEYS.ARTICLE_BY_ID(String(ctx.entity.id))] : [];
  return [...standardInvalidate(ctx, params), ...byId];
});

/**
 * invalidate EVENT (clé `invalidate:event`) = `invalidate:standard` (userList "events" en création,
 * about-par-slug en édition, fil admin via `searchKeys`) + les DEUX préfixes AGENDA (calendrier + liste,
 * tous scopes/plages). L'agenda utilise un espace de clés `["agenda", …]` DISJOINT de
 * `SEARCH_QUERY_KEYS.RESULTS` (ce que `searchKeys` invalide) → sans ces préfixes, un event créé/validé ne
 * rafraîchit pas la page /agenda. Mêmes params que standard (`userList`, `searchKeys`).
 */
registerInvalidateFn("invalidate:event", (ctx, params) => [
  ...standardInvalidate(ctx, params),
  AGENDA_QUERY_KEYS.CALENDAR_PREFIX(),
  AGENDA_QUERY_KEYS.LIST_PREFIX(),
]);
