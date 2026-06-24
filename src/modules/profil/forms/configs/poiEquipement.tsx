/**
 * Config de la modale poi-équipement (costum equipementsSportifs974) pour `EntityFormModal` — remplace
 * le fichier `PoiEquipementGenericModal.tsx`. 100 % données + closures runtime (scope/defaults/slots/spec).
 */
import type { EntityTypes, Poi } from "@communecter/cocolight-api-client";
import type { FieldValues } from "react-hook-form";
import { formDescriptorToConfig } from "@/modules/formEngine";
import { PROFIL_QUERY_KEYS } from "../../constants";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants";
import { ParentInfoReadonly } from "../../components/profile-edit/fields";
import { poiEquipementDescriptor } from "../poiEquipement.descriptor";
import { PoiEquipementDoublonsSlot } from "../PoiEquipementDoublonsSlot";
import { buildPipelineDefaults, buildPipelinePayload } from "../jsonFormSubmit";
import { resolvePoiEquipementScope, createEmptyDefaults, type PoiEquipementScope } from "../../components/add/poiEquipement";
import type { AddPoiFormData } from "../../schemaForm";
import { buildAddPoiPayload } from "../../components/add/poiEquipement";
import type { EntityModalConfig } from "../EntityFormModal";

/** Config JSON dérivée du descripteur (read/write d'édition passent par buildPipeline*). */
const POI_CONFIG = formDescriptorToConfig(poiEquipementDescriptor);
/** Invalidation recherche (liste équipements + détection doublons), comme l'ancien modal. */
const SEARCH_KEYS = [
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostumStatic"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("poi-equipement-matches"),
];

export const poiEquipementModalConfig: EntityModalConfig = {
  descriptor: poiEquipementDescriptor,
  title: { add: "AddPoiEquipement.title.add", edit: "AddPoiEquipement.title.edit" },
  description: { add: "AddPoiEquipement.description.add", edit: "AddPoiEquipement.description.edit" },
  submitLabel: { add: "AddEntity.create", edit: "ProfileEdit.save" },
  dialogClassName: "sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden",
  validationFailedKey: "AddPoiEquipement.validationFailed",
  listsFromCarrier: true,
  imageField: "_imageFile",
  imageExistingUrl: (poi) => {
    const sd = (poi as Poi).serverData;
    return sd?.profilMediumImageUrl || sd?.profilImageUrl || sd?.profilThumbImageUrl || undefined;
  },
  resolveScope: (carrier) => resolvePoiEquipementScope(carrier),
  texts: (t) => ({
    next: t("AddPoiEquipement.buttons.next"),
    previous: t("AddPoiEquipement.buttons.previous"),
    cancel: t("common.cancel"),
    stepLabel: (index, total) => t("AddPoiEquipement.stepIndicator", undefined, { index, total }) as string,
  }),

  // READ : édition → seedEntity via la config (== buildEditDefaults) ; création → socle scope-aware.
  buildDefaults: ({ mode, entity, scope }) => {
    const sc = scope as PoiEquipementScope;
    return mode === "edit" && entity
      ? (buildPipelineDefaults(POI_CONFIG, entity, { baseDefaults: () => createEmptyDefaults(sc) as unknown as Record<string, unknown> }) as FieldValues)
      : (createEmptyDefaults(sc) as unknown as FieldValues);
  },

  // Retire les URLs vides (entrées ajoutées non remplies) — parité ancien form.
  cleanValues: (v) => ({
    ...v,
    urls: Array.isArray(v.urls) ? (v.urls as unknown[]).filter((u) => String(u ?? "").trim().length > 0) : v.urls,
  }),

  // Slots UI : parent en lecture seule + détection de doublons (scope-aware).
  slots: ({ parent, scope }) => ({
    parentInfo: <ParentInfoReadonly parent={(parent as EntityTypes) ?? null} />,
    doublons: <PoiEquipementDoublonsSlot scope={scope as PoiEquipementScope} />,
  }),

  // WRITE : create scopé costum (me.costum(sourceKey).poi) ; edit = payload complet via la config.
  buildSpec: ({ mode, entity, parent, scope, me }) => {
    if (mode === "edit") {
      return {
        mode: "edit", entityType: "poi", target: entity, imageField: "_imageFile",
        buildPayload: (d) => buildPipelinePayload(POI_CONFIG, d, { emitEmpty: true }),
        successKey: "toast.profile.updateSuccess", errorKey: "toast.profile.updateError",
        errorContext: "EntityFormModal · UPDATE_POI",
        invalidateQueries: [
          ...(entity?.slug ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
          ...SEARCH_KEYS,
        ],
      };
    }
    const sc = scope as PoiEquipementScope;
    const target = parent ?? me;
    return {
      mode: "add", entityType: "poi", target: parent ?? null, costumSlug: sc.sourceKey, imageField: "_imageFile",
      buildPayload: (d) => buildAddPoiPayload(d as unknown as AddPoiFormData) as Record<string, unknown>,
      inject: { parent: parent ?? null },
      navigateOnSuccess: false,
      successKey: "toast.add.poiSuccess", errorKey: "toast.add.poiError",
      errorContext: "EntityFormModal · ADD_POI",
      invalidateQueries: [
        ...(target ? [PROFIL_QUERY_KEYS.USER_POIS_PREFIX(target.slug)] : []),
        ...(parent ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(parent.slug)] : []),
        ...SEARCH_KEYS,
      ],
    };
  },
};
