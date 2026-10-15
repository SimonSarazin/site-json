/**
 * Fns de spec COMMUNES aux costums (registre `specRegistries`, pas des transforms) — l'import (side-effect)
 * enregistre les clés partagées. Pendant de `sharedCodecs` mais pour les fns de modale (existingUrl, …).
 */
import { createElement, Suspense } from "react";
import { lazy } from "vite-preload";
import type { QueryKey } from "@tanstack/react-query";
import { registerExistingUrlFn, registerCleanValuesFn, registerInvalidateFn, registerSlotFn, registerAfterSubmitFn, type InvalidateFn } from "../specRegistries";
import { PROFIL_QUERY_KEYS } from "../../constants";
import { SEARCH_QUERY_KEYS, SEARCH_STAT_COUNT_PREFIX } from "@/modules/search/constants";
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
 * Les chiffres des tuiles de stat (`SEARCH_STAT_COUNT_PREFIX`) suivent TOUJOURS : leurs périmètres vivent
 * dans les sections, pas dans les `searchKeys` du formulaire.
 */
const standardInvalidate: InvalidateFn = (ctx, params) => {
  const searchKeys = [
    ...((params?.searchKeys as string[] | undefined) ?? []).map((k) => SEARCH_QUERY_KEYS.RESULTS_PREFIX(k)),
    SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STAT_COUNT_PREFIX),
  ];
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


/**
 * afterSubmit GÉNÉRIQUE (clé `afterSubmit:reloadOnSlugChange`) : en ÉDITION, si le `slug` soumis diffère
 * de celui de l'entité, réécrit l'URL courante et recharge — même effet que `editProfileConfig.afterSubmit`
 * (modale de profil standard), rendu disponible aux formulaires costum qui exposent le slug (ex. le
 * formulaire citoyen : le slug est le nom d'utilisateur, donc le chemin `/profil/<slug>` du profil ouvert).
 * Inerte en création et hors navigateur.
 */
registerAfterSubmitFn("afterSubmit:reloadOnSlugChange", (ctx, values) => {
  if (ctx.mode !== "edit" || typeof window === "undefined") return;
  const oldSlug = ctx.entity?.slug;
  const newSlug = values.slug as string | undefined;
  if (newSlug && oldSlug && newSlug !== oldSlug) {
    window.history.replaceState(null, "", window.location.pathname.replace(oldSlug, newSlug));
    window.location.reload();
  }
});

// Chargé à la demande : le slot ne sert qu'aux formulaires qui déclarent `duplicateCheck`, et en
// création seulement — les autres ne paient rien. Constante de module (pas dans la SlotFn) : un
// `lazy()` recréé à chaque appel remonterait le composant à chaque rendu.
const EntityDuplicatesSlot = lazy(() => import("../EntityDuplicatesSlot"));

/**
 * Slot GÉNÉRIQUE « doublons à la création » (clé `slot:entityDuplicates`) — enregistré ICI, dans le
 * barrel commun, pour être disponible à tout formulaire costum 100 % config. Paramètres : bloc
 * `duplicateCheck` de la spec. Inerte (rend `null`) en édition et sans bloc déclaré. La frontière
 * Suspense est propre au slot : celle du moteur entoure tout le formulaire.
 */
registerSlotFn("slot:entityDuplicates", (ctx, spec) =>
  ctx.mode === "add" && spec?.duplicateCheck
    ? createElement(Suspense, { fallback: null }, createElement(EntityDuplicatesSlot, { params: spec.duplicateCheck }))
    : null,
);
