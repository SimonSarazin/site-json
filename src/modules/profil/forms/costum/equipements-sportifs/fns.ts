/**
 * Module du costum « équipement sportif » (POI SSBE, equipementsSportifs974) : scope, defaults, transforms
 * `poi:*`, recherche de doublons, payload de création — ET enregistrement des CLÉS (descripteur + fns) que
 * la `spec.ts` référence. C'est le `fns.ts` du dossier `forms/costum/equipements-sportifs/` (cf. plan).
 * `buildAddPoiPayload` reste exporté (réutilisé transitoirement par le poi STANDARD via addStandard.tsx,
 * jusqu'à sa propre bascule pipeline).
 */
// Helpers de pipeline partagés (imports DIRECTS, pas le barrel formEngine → util pur testable sans
// tirer les widgets/composants). cf. doc/refactor-field-treatment.md.
import { createElement } from "react";
import "@/modules/formEngine/engine/coercions"; // side-effect : enregistre les coerce:* (read par type des champs)
import { ADDRESS_KEYS } from "../sharedCodecs"; // + side-effect : enregistre les codecs communs address:read/write
import { seedEntity, buildPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import "../../geoTransforms"; // enregistre geo:write / geoPosition:write (partagés)
import type { FormValues } from "@/modules/formEngine";
import { equipementsSportifsDescriptor } from "./descriptor";
import { PROFIL_QUERY_KEYS } from "../../../constants";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants";
import { ParentInfoReadonly } from "../../../components/profile-edit/fields";
import { PoiEquipementDoublonsSlot } from "../../PoiEquipementDoublonsSlot";
import type { EntityModalCtx } from "../../entityModalSpec";
import {
  registerDescriptor, registerScopeFn, registerDefaultsFn, registerSlot,
  registerCleanValuesFn, registerInvalidateFn,
} from "../../specRegistries";
import "../sharedFns"; // side-effect : enregistre la clé commune image:profilUrl


// ── Scope du costum "équipement sportif" (dérivé de l'entité costum) ──────────
/**
 * Périmètre du costum équipement sportif. `parentId`/`sourceKey` viennent EXCLUSIVEMENT de l'ENTITÉ porteuse
 * (`useCocolight().entity` : `entity.id` / `entity.serverData.slug`) — l'entité live est la source de vérité,
 * le scope s'adapte donc automatiquement par déploiement (PLUS de fallback en dur, qui ré-injectait l'id SSBE).
 * `poiType`/`addressCountry` sont les SEULES constantes de config (`spec.scope.defaults`).
 */
export interface PoiEquipementScope {
  parentId: string;
  sourceKey: string;
  poiType: string;
  addressCountry: string;
}

/** Constantes de déploiement du scope (DONNÉE de config `spec.scope.defaults`) — uniquement le domaine SSBE. */
export interface PoiEquipementScopeDefaults {
  poiType: string;
  addressCountry: string;
}

/** Entité costum minimale utile à la résolution du scope (cf. `useCocolight().entity`). */
type ScopeEntity = { id?: string | null; serverData?: { slug?: string | null } | null } | null | undefined;

/**
 * Résout le scope : `parentId`/`sourceKey` LUS du carrier live (id + slug), `poiType`/`addressCountry` = les
 * constantes de config. Si le carrier est absent, parentId/sourceKey sont vides (la modale n'a pas lieu d'être
 * ouverte hors contexte costum) — pas de fallback en dur sur un id de déploiement.
 */
export function resolvePoiEquipementScope(entity: ScopeEntity, defaults: PoiEquipementScopeDefaults): PoiEquipementScope {
  const slug = entity?.serverData?.slug;
  return {
    parentId: entity?.id ?? "",
    sourceKey: typeof slug === "string" ? slug.trim() : "",
    poiType: defaults.poiType,
    addressCountry: defaults.addressCountry,
  };
}

// Socle ADRESSE : membres du groupe `address` (seedFromEntity ne leur applique pas de `field.default` car lus
// via le groupe). Dérivé des `ADDRESS_KEYS` communs → "" partout, sauf `addressCountry` = pays du scope.
const POI_ADDRESS_BASE = (scope: PoiEquipementScope): Record<string, unknown> =>
  ({ ...Object.fromEntries(ADDRESS_KEYS.map((k) => [k, ""])), addressCountry: scope.addressCountry });

// Defaults DÉRIVÉS du descripteur — plus de re-listage des ~36 champs. `seedEntity(descriptor, null)` applique
// les `field.default` (text→"", number→undefined via coerce:number, switch→false, array→[]) et EXCLUT déjà
// renderOnly/writeOnly (_imageFile/address/geo/geoPosition). On ajoute seulement le socle adresse (membres de
// groupe) + `type` (stamp ; émis au create par inject.extraFieldsFromScope). Byte-parité figée par defaults.byteparity.test.
export const createEmptyDefaults = (scope: PoiEquipementScope): FormValues => ({
  ...(seedEntity({ descriptor: equipementsSportifsDescriptor, baseDefaults: () => POI_ADDRESS_BASE(scope) }, null) as Record<string, unknown>),
  type: scope.poiType,
}) as FormValues;

// READ adresse : codec COMMUN `address:read` (cf. ../sharedCodecs, omit-empty) référencé par serializeGroups.
// WRITE adresse : champs plats du form → objet `address` imbriqué (ou `undefined` si pas de localityId →
// clé omise, parité buildAddressFromForm). `all` = toutes les valeurs de form.
// poi:addressWrite SUPPRIMÉ → codec commun `address:write` (sharedCodecs), référencé par serializeGroups.address.

/**
 * Spec POI = descripteur UNIFIÉ (render + read/write) `equipementsSportifsDescriptor` + socle createEmptyDefaults.
 * Le MÊME descripteur pilote le rendu (GenericForm), le READ (seedEntity), le WRITE create/edit (buildPayload)
 * ET la config (formDescriptorToConfig). Les transforms `poi:*` référencés par ses champs sont enregistrés
 * ci-dessus (poi:addressWrite) + le codec commun `address:read` + `geo:*` via l'import geoTransforms. cf. tiers-lieu.
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
export function buildAddPoiPayload(data: FormValues): Record<string, unknown> {
  const payload = buildPayload(POI_SPEC, data) as Record<string, unknown>;
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
registerScopeFn("poi:scope", (carrier, defaults) => resolvePoiEquipementScope(carrier as ScopeEntity, defaults as unknown as PoiEquipementScopeDefaults));
registerDefaultsFn("poi:emptyDefaults", (ctx) => createEmptyDefaults(ctx.scope as PoiEquipementScope) as unknown as Record<string, unknown>);
registerSlot("parentInfo", (ctx: EntityModalCtx) => createElement(ParentInfoReadonly, { parent: ctx.parent ?? null }));
registerSlot("poiDoublons", (ctx: EntityModalCtx) => createElement(PoiEquipementDoublonsSlot, { scope: ctx.scope as PoiEquipementScope }));
registerCleanValuesFn("poi:dropEmptyUrls", (v) => ({
  ...v,
  urls: Array.isArray(v.urls) ? (v.urls as unknown[]).filter((u) => String(u ?? "").trim().length > 0) : v.urls,
}));
// image:profilUrl : clé COMMUNE enregistrée dans ../sharedFns (importé en side-effect ci-dessous).
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
