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

/** Entité costum minimale utile à la résolution du scope (cf. `useCocolight().entity`). */
type ScopeEntity = { id?: string | null; serverData?: { slug?: string | null } | null } | null | undefined;

/**
 * Résout le scope depuis l'entité du costum + les `defaults` de config (`spec.scope.defaults`) :
 * `parentId` = id de l'org costum (sinon defaults), `sourceKey` = son slug (sinon defaults). `poiType` /
 * `addressCountry` = constantes de déploiement, fournies par les defaults (DONNÉE de config). Plus aucune
 * constante de scope codée en dur ici (ex-DEFAULT_POI_EQUIPEMENT_SCOPE retiré → vit dans `spec.scope.defaults`).
 */
export function resolvePoiEquipementScope(entity: ScopeEntity, defaults: PoiEquipementScope): PoiEquipementScope {
  const slug = entity?.serverData?.slug;
  return {
    parentId: entity?.id || defaults.parentId,
    sourceKey: typeof slug === "string" && slug.trim().length > 0 ? slug.trim() : defaults.sourceKey,
    poiType: defaults.poiType,
    addressCountry: defaults.addressCountry,
  };
}

// Coerceurs de TYPE (string/number/bool/array/date) : désormais GÉNÉRIQUES dans formEngine
// (`coerceString`/`coerceNumber`/… enregistrés `coerce:*`). poi:addressRead réutilise `coerceString`.

export const createEmptyDefaults = (scope: PoiEquipementScope): AddPoiFormData => ({
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

// ── READ adresse (serializeGroup) : objet serveur `address` → champs plats ──────
// 14 clés SIG (round-trip COMPLET requis par l'édition unifiée S6 : sinon l'adresse reconstruite écraserait
// les niveaux serveur). OMIT-EMPTY : un champ vide est OMIS du retour → le SOCLE (createEmptyDefaults, dont
// `addressCountry` vient de `spec.scope.defaults`) le fournit. seedEntity = {...socle, ...read} : un "" du read
// écraserait le socle, donc on omet les vides → parité buildEditDefaults (`addressCountry` retombe sur le
// pays de scope si vide, les autres sur "") SANS aucune constante de pays codée ici.
const ADDRESS_READ_KEYS = [
  "addressCountry", "addressLocality", "localityId", "postalCode", "streetAddress",
  "level1", "level1Name", "level2", "level2Name", "level3", "level3Name", "level4", "level4Name", "codeInsee",
] as const;
registerTransform("poi:addressRead", (a) => {
  const o = (a ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ADDRESS_READ_KEYS) {
    const v = coerceString(o[k]);
    if (v) out[k] = v; // vide → omis (le socle fournit le défaut)
  }
  return out;
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
// baseDefaults omis : buildAddPoiPayload utilise buildPayload (WRITE), qui n'utilise PAS baseDefaults
// (réservé au READ/seedEntity). createEmptyDefaults exige désormais un scope → fourni au READ via le résolveur.
const POI_SPEC: FormSpec = { descriptor: equipementsSportifsDescriptor };

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
registerScopeFn("poi:scope", (carrier, defaults) => resolvePoiEquipementScope(carrier as ScopeEntity, defaults as unknown as PoiEquipementScope));
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
