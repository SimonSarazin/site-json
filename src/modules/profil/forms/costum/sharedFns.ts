/**
 * Fns de spec COMMUNES aux costums (registre `specRegistries`, pas des transforms) — l'import (side-effect)
 * enregistre les clés partagées. Pendant de `sharedCodecs` mais pour les fns de modale (existingUrl, …).
 */
import type { QueryKey } from "@tanstack/react-query";
import { registerExistingUrlFn, registerCleanValuesFn, registerInvalidateFn } from "../specRegistries";
import { PROFIL_QUERY_KEYS } from "../../constants";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants";

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
registerInvalidateFn("invalidate:standard", (ctx, params) => {
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
});
