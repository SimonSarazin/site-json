/**
 * Hooks de CRÉATION (+ useUpdatePoi édition) — désormais de MINCES SPECS au-dessus de `useEntityMutation`
 * (cœur générique unique, cf. useEntityMutation.tsx). Chaque hook ne fait que déclarer son spec :
 * cible, buildPayload (closure), extras create (role/parent/organizer), scope costum, image, invalidation.
 * Le comportement (payload/scope/save/image/nav/toasts) est prouvé byte-égal par useEntityMutation.test.
 */
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { PROFIL_QUERY_KEYS } from "../constants";
import { useCocolight } from "@/hooks/useCocolight";
import type { AddPoiFormData } from "../schemaForm";
import { buildTiersLieuxPayload } from "../utils/tiersLieuxMapping";
import { buildProfileUpdateData } from "../forms/editProfilePayload";
import type { TiersLieuxSubmitPayload } from "../utils/tiersLieux.schema";
import { buildAddPoiPayload } from "../components/add/poiEquipement";
import { useEntityMutation } from "./useEntityMutation";
import { useSite } from "@/hooks/useSite";
import { getSlug } from "@/lib/constant/common";

type Data = Record<string, unknown>;

/** Crée une organisation (`role` create-only ré-injecté ; email "" omis — ADD_ORGANIZATION strict). */
export function useAddOrganization(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const target = entity ?? me;
  return useEntityMutation({
    mode: "add", entityType: "organizations", target: entity ?? null,
    buildPayload: (d) => buildProfileUpdateData("organizations", d),
    inject: { role: true, dropEmptyEmail: true },
    successKey: "toast.add.organizationSuccess", errorKey: "toast.add.organizationError",
    errorContext: "useAddOrganization · ADD_ORGANIZATION",
    invalidateQueries: target ? [PROFIL_QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(target.slug)] : [],
  });
}

/** Crée un projet (`role` + `parent` de sous-création depuis l'entité créatrice). */
export function useAddProject(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const target = entity ?? me;
  return useEntityMutation({
    mode: "add", entityType: "projects", target: entity ?? null,
    buildPayload: (d) => buildProfileUpdateData("projects", d),
    inject: { role: true, parent: entity ?? null },
    successKey: "toast.add.projectSuccess", errorKey: "toast.add.projectError",
    errorContext: "useAddProject · ADD_PROJECT",
    invalidateQueries: [
      ...(target ? [PROFIL_QUERY_KEYS.USER_PROJECTS_PREFIX(target.slug)] : []),
      ...(entity ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
    ],
  });
}

/** Crée un événement (`role` + `parent` + organizer obligatoire → fallback sur l'entité créatrice/me). */
export function useAddEvent(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const target = entity ?? me;
  return useEntityMutation({
    mode: "add", entityType: "events", target: entity ?? null,
    buildPayload: (d) => buildProfileUpdateData("events", d),
    inject: { role: true, parent: entity ?? null, organizerFallback: entity ?? null },
    successKey: "toast.add.eventSuccess", errorKey: "toast.add.eventError",
    errorContext: "useAddEvent · ADD_EVENT",
    invalidateQueries: [
      ...(target ? [PROFIL_QUERY_KEYS.USER_EVENTS_PREFIX(target.slug)] : []),
      ...(entity ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
    ],
  });
}

/**
 * Crée un POI. `options.costumSlug` (OPT-IN) → création scopée costum (`me.costum(slug).poi()`, la lib
 * injecte costumSlug/costumId/costumType + presets, backend pose `source`). `_imageFile` → `profil_avatar`.
 * `navigateOnSuccess:false` → rester sur la page (ex. ajout depuis la liste équipements).
 */
export function useAddPoi(
  entity?: EntityTypes | null,
  extraFields?: Record<string, unknown>,
  options?: { navigateOnSuccess?: boolean; costumSlug?: string },
) {
  const { me } = useCocolight();
  const target = entity ?? me;
  return useEntityMutation({
    mode: "add", entityType: "poi", target: entity ?? null,
    costumSlug: options?.costumSlug,
    imageField: "_imageFile",
    buildPayload: (d) => buildAddPoiPayload(d as unknown as AddPoiFormData) as Data,
    inject: { parent: entity ?? null, extraFields },
    navigateOnSuccess: options?.navigateOnSuccess ?? true,
    successKey: "toast.add.poiSuccess", errorKey: "toast.add.poiError",
    errorContext: "useAddPoi · ADD_POI",
    invalidateQueries: [
      ...(target ? [PROFIL_QUERY_KEYS.USER_POIS_PREFIX(target.slug)] : []),
      ...(entity ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
    ],
  });
}

/**
 * Édite un POI (pattern unifié S6). `data` = payload COMPLET déjà construit par la modale (buildPipelinePayload)
 * + `_imageFile`/`_imageDeleted` → submitEntityEdit (Object.assign + save + suppression image). buildPayload = identité.
 */
export function useUpdatePoi(poi: EntityTypes | null) {
  return useEntityMutation({
    mode: "edit", entityType: "poi", target: poi,
    imageField: "_imageFile",
    buildPayload: (d) => d,
    successKey: "toast.profile.updateSuccess", errorKey: "toast.profile.updateError",
    errorContext: "useUpdatePoi · UPDATE_POI",
    invalidateQueries: poi ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(poi.slug)] : [],
  });
}

export type AddTiersLieuFormData = TiersLieuxSubmitPayload;

/**
 * Crée un tiers-lieu (org costum). Scope costum résolu au runtime = slug de l'entité porteuse (VITE_SLUG) ;
 * `config.costum` ne sert qu'aux tags (mainTag/compagnon, via buildTiersLieuxPayload). `_logoFile` → `profil_avatar`.
 */
export function useAddTiersLieu(entity?: EntityTypes | null) {
  const { me, entity: costumEntity } = useCocolight();
  const { config } = useSite();
  const target = entity ?? me;
  const costum = config.costum;
  const carrierSlug = costumEntity?.serverData?.slug;
  const slug = typeof carrierSlug === "string" && carrierSlug.trim() ? carrierSlug.trim() : getSlug();
  return useEntityMutation({
    mode: "add", entityType: "organizations", target: entity ?? null,
    costumSlug: slug,
    imageField: "_logoFile",
    buildPayload: (d) => buildTiersLieuxPayload(d as unknown as TiersLieuxSubmitPayload, costum ? { costum } : undefined),
    successKey: "AddTiersLieux.toast.success", errorKey: "AddTiersLieux.toast.error",
    errorContext: "useAddTiersLieu · ADD_TIERSLIEU",
    invalidateQueries: target ? [PROFIL_QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(target.slug)] : [],
  });
}
