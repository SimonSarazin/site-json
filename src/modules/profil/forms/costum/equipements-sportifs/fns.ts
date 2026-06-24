/**
 * Module du costum « équipement sportif » (POI SSBE, equipementsSportifs974) : scope, defaults, transforms
 * `poi:*`, recherche de doublons, payload de création — ET enregistrement des CLÉS (descripteur + fns) que
 * la `spec.ts` référence. C'est le `fns.ts` du dossier `forms/costum/equipements-sportifs/` (cf. plan).
 * `buildAddPoiPayload` reste exporté (réutilisé transitoirement par le poi STANDARD via addStandard.tsx,
 * jusqu'à sa propre bascule pipeline).
 */
import type { AddPoiFormData } from "../../../schemaForm";
// Helpers de pipeline partagés (imports DIRECTS, pas le barrel formEngine → util pur testable sans
// tirer les widgets/composants). cf. doc/refactor-field-treatment.md.
import { createElement } from "react";
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import { coerceString } from "@/modules/formEngine/engine/coercions"; // side-effect : enregistre coerce:* + fournit coerceString (poi:addressRead)
import { buildPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import "../../geoTransforms"; // enregistre geo:write / geoPosition:write (partagés)
import type { FormValues } from "@/modules/formEngine";
import { equipementsSportifsDescriptor } from "./descriptor";
import { buildAddressFromForm } from "../../../hooks/mutationUtils";
import { PROFIL_QUERY_KEYS } from "../../../constants";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants";
import { ParentInfoReadonly } from "../../../components/profile-edit/fields";
import { PoiEquipementDoublonsSlot } from "../../PoiEquipementDoublonsSlot";
import type { EntityModalCtx } from "../../entityModalSpec";
import {
  registerDescriptor, registerScopeFn, registerDefaultsFn, registerSlot,
  registerCleanValuesFn, registerExistingUrlFn, registerInvalidateFn,
} from "../../specRegistries";


// ── Scope du costum "équipement sportif" (dérivé de l'entité costum) ──────────
/**
 * Périmètre du costum équipement sportif. `parentId`/`sourceKey` sont dérivés de
 * l'ENTITÉ du costum (`useCocolight().entity` : `entity.id` / `entity.serverData.slug`),
 * pas d'une config — l'entité est la source de vérité et le scope s'adapte donc
 * automatiquement par déploiement. Les constantes ci-dessous ne servent que de
 * FALLBACK (entité indisponible). `poiType`/`addressCountry` sont des constantes
 * du domaine SSBE.
 */
export interface PoiEquipementScope {
  parentId: string;
  sourceKey: string;
  poiType: string;
  addressCountry: string;
}

export const DEFAULT_POI_EQUIPEMENT_SCOPE: PoiEquipementScope = {
  parentId: "6a04155ed047177b92399685",
  sourceKey: "equipementsSportifs974",
  poiType: "recoveryCenter",
  addressCountry: "RE",
};

/** Entité costum minimale utile à la résolution du scope (cf. `useCocolight().entity`). */
type ScopeEntity = { id?: string | null; serverData?: { slug?: string | null } | null } | null | undefined;

/**
 * Résout le scope depuis l'entité du costum : `parentId` = id de l'org costum,
 * `sourceKey` = son slug. Fallback sur les constantes SSBE si l'entité est absente.
 */
export function resolvePoiEquipementScope(entity?: ScopeEntity): PoiEquipementScope {
  const d = DEFAULT_POI_EQUIPEMENT_SCOPE;
  const slug = entity?.serverData?.slug;
  return {
    parentId: entity?.id || d.parentId,
    sourceKey: typeof slug === "string" && slug.trim().length > 0 ? slug.trim() : d.sourceKey,
    poiType: d.poiType,
    addressCountry: d.addressCountry,
  };
}

// Coerceurs de TYPE (string/number/bool/array/date) : désormais GÉNÉRIQUES dans formEngine
// (`coerceString`/`coerceNumber`/… enregistrés `coerce:*`). poi:addressRead réutilise `coerceString`.

export const createEmptyDefaults = (
  scope: PoiEquipementScope = DEFAULT_POI_EQUIPEMENT_SCOPE
): AddPoiFormData => ({
  name: "",
  type: scope.poiType as AddPoiFormData["type"],
  description: "",
  tags: [],
  urls: [],
  addressCountry: scope.addressCountry,
  addressLocality: "",
  localityId: "",
  postalCode: "",
  streetAddress: "",
  level1: "", level1Name: "", level2: "", level2Name: "",
  level3: "", level3Name: "", level4: "", level4Name: "", codeInsee: "",
  inst_acc_handi_bool: false,
  inst_trans_bool: false,
  equip_type_name: "",
  equip_type_famille: "",
  inst_date_creation: "",
  inst_enqu_date: "",
  equip_maj_date: "",
  equip_nature: "",
  equip_sol: "",
  equip_surf: undefined,
  equip_eclair: false,
  categorie: "",
  aps_name: [],
  equip_acc_libre: false,
  inst_acc_handi_type: "",
  inst_trans_type: "",
  inst_part_bool: false,
  inst_part_type: [],
  equip_prop_nom: "",
  equip_prop_type: "",
  equip_gest_type: "",
  equip_pmr_acc: false,
  equip_pmr_chem: false,
  equip_pmr_douche: false,
  equip_pmr_sanit: false,
  equip_pmr_trib: false,
  equip_pmr_vest: false,
  equip_pshs_aire: false,
  equip_pshs_chem: false,
  equip_pshs_sanit: false,
  equip_pshs_trib: false,
  equip_pshs_vest: false,
  equip_pshs_sign: false,
  equip_larg: undefined,
  equip_long: undefined,
  equip_douche: false,
  equip_loc_type: [],
  equip_utilisateur: [],
  inst_nom: "",
});

// ── READ via pipeline (P2) : remplace le mapping coercer-par-coercer ───────────
// Coercers enregistrés comme transformers nommés + un descripteur de LECTURE déclaratif (coercer `read`
// + `default` par champ ; adresse = groupe de sérialisation objet `address` → 5 champs plats).
// `seedFromEntity(POI_READ_DESCRIPTOR, serverData)` reproduit l'ancien buildEditDefaults byte-pour-byte
// (prouvé en test) — création (serverData={}) ET édition. cf. doc/refactor-field-treatment.md (P2).
// Adresse : objet serveur `address` → 5 champs plats. Parité buildEditDefaults : addressCountry retombe
// sur le défaut de scope ("RE") si vide ; les 4 autres sur "". (Écriture = P2-suite, ici read seulement.)
registerTransform("poi:addressRead", (a) => {
  const o = (a ?? {}) as Record<string, unknown>;
  return {
    addressCountry: coerceString(o.addressCountry) || DEFAULT_POI_EQUIPEMENT_SCOPE.addressCountry,
    addressLocality: coerceString(o.addressLocality),
    localityId: coerceString(o.localityId),
    postalCode: coerceString(o.postalCode),
    streetAddress: coerceString(o.streetAddress),
    // 9 champs SIG (level1..4/codeInsee) : round-trip COMPLET requis par l'édition unifiée (S6) — sinon
    // l'adresse reconstruite (payload complet) écraserait les niveaux serveur. Parité tl:addressRead.
    level1: coerceString(o.level1), level1Name: coerceString(o.level1Name),
    level2: coerceString(o.level2), level2Name: coerceString(o.level2Name),
    level3: coerceString(o.level3), level3Name: coerceString(o.level3Name),
    level4: coerceString(o.level4), level4Name: coerceString(o.level4Name),
    codeInsee: coerceString(o.codeInsee),
  };
});
// WRITE adresse : champs plats du form → objet `address` imbriqué (ou `undefined` si pas de localityId →
// clé omise, parité buildAddressFromForm). `all` = toutes les valeurs de form.
registerTransform("poi:addressWrite", (all) => buildAddressFromForm((all ?? {}) as Record<string, string>));

/**
 * Spec POI = descripteur UNIFIÉ (render + read/write) `equipementsSportifsDescriptor` + socle createEmptyDefaults.
 * Le MÊME descripteur pilote le rendu (GenericForm), le READ (seedEntity), le WRITE create/edit (buildPayload)
 * ET la config (formDescriptorToConfig). Les transforms `poi:*` référencés par ses champs sont enregistrés
 * ci-dessus (poi:toString/…, poi:addressRead/Write) + `geo:*` via l'import geoTransforms. cf. tiers-lieu.
 */
const POI_SPEC: FormSpec = { descriptor: equipementsSportifsDescriptor, baseDefaults: () => createEmptyDefaults() as unknown as FormValues };

/**
 * Payload de CRÉATION POI (pipeline, omit-empty) : adresse imbriquée, geo coercé, champs équipement typés
 * (poi:toString/toNumber/toBoolean), via le descripteur unifié. Le READ (defaults) et le WRITE d'édition
 * passent désormais par les helpers config-driven du host (buildPipelineDefaults/buildPipelinePayload, cf.
 * costum/equipements-sportifs/spec.ts). parent/extraFields/image gérés par l'appelant (useEntityMutation).
 */
export function buildAddPoiPayload(data: AddPoiFormData): Record<string, unknown> {
  const payload = buildPayload(POI_SPEC, data as unknown as FormValues) as Record<string, unknown>;
  // `type` n'est plus un champ du descripteur (devenu STAMP costum, posé au create par inject.extraFields).
  // Le costum n'appelle plus ce builder (il passe par le pipeline). Mais le poi STANDARD (addStandard) le
  // réutilise et porte SON type (ex. "place") via le form → on le réémet ici depuis `data`. (Pont transitoire
  // jusqu'à ce que le poi standard ait son propre payload.)
  if (data.type) payload.type = data.type;
  return payload;
}

// ── Enregistrement des CLÉS référencées par `spec.ts` (descripteur + fns costum) ───────────────────────────
// Le payload (add ET edit) passe par le PIPELINE générique (défaut du résolveur) : buildAddPoiPayload(d) ≡
// buildPipelinePayload(config, d, {emitEmpty:false}) par round-trip lossless → AUCUN payloadFn custom requis.
registerDescriptor(equipementsSportifsDescriptor);
registerScopeFn("poi:scope", (carrier) => resolvePoiEquipementScope(carrier as Parameters<typeof resolvePoiEquipementScope>[0]));
registerDefaultsFn("poi:emptyDefaults", (ctx) => createEmptyDefaults(ctx.scope as PoiEquipementScope) as unknown as Record<string, unknown>);
registerSlot("parentInfo", (ctx: EntityModalCtx) => createElement(ParentInfoReadonly, { parent: ctx.parent ?? null }));
registerSlot("poiDoublons", (ctx: EntityModalCtx) => createElement(PoiEquipementDoublonsSlot, { scope: ctx.scope as PoiEquipementScope }));
registerCleanValuesFn("poi:dropEmptyUrls", (v) => ({
  ...v,
  urls: Array.isArray(v.urls) ? (v.urls as unknown[]).filter((u) => String(u ?? "").trim().length > 0) : v.urls,
}));
registerExistingUrlFn("image:profilUrl", (entity) => {
  const sd = (entity as { serverData?: Record<string, unknown> }).serverData;
  return (sd?.profilMediumImageUrl || sd?.profilImageUrl || sd?.profilThumbImageUrl || undefined) as string | undefined;
});
const POI_SEARCH_KEYS = [
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("searchCostumStatic"),
  SEARCH_QUERY_KEYS.RESULTS_PREFIX("poi-equipement-matches"),
];
registerInvalidateFn("poi:invalidate", (ctx) => {
  if (ctx.mode === "edit") {
    return [...(ctx.entity?.slug ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(ctx.entity.slug)] : []), ...POI_SEARCH_KEYS];
  }
  const target = ctx.parent ?? ctx.me;
  return [
    ...(target ? [PROFIL_QUERY_KEYS.USER_POIS_PREFIX(target.slug)] : []),
    ...(ctx.parent ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(ctx.parent.slug)] : []),
    ...POI_SEARCH_KEYS,
  ];
});
