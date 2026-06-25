/**
 * Module du costum « équipement sportif » (POI SSBE, equipementsSportifs974) : scope, defaults, recherche de
 * doublons (slots) — ET enregistrement des CLÉS (descripteur + fns) que la `spec.ts` référence. C'est le
 * `fns.ts` du dossier `forms/costum/equipements-sportifs/` (cf. plan). Le payload passe par le pipeline
 * générique (aucun payloadFn custom). (`buildAddPoiPayload` du poi STANDARD a été déplacé → `../../addPoi.payload`.)
 */
// Helpers de pipeline partagés (imports DIRECTS, pas le barrel formEngine → util pur testable sans
// tirer les widgets/composants). cf. doc/refactor-field-treatment.md.
import { createElement } from "react";
import "@/modules/formEngine/engine/coercions"; // side-effect : enregistre les coerce:* (read par type des champs)
import { ADDRESS_KEYS } from "../sharedCodecs"; // + side-effect : enregistre les codecs communs address:read/write
import { seedEntity } from "@/modules/formEngine/engine/entityForm";
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

// READ/WRITE adresse : codecs COMMUNS `address:read`/`address:write` (cf. ../sharedCodecs), référencés par
// serializeGroups.address. geo via ../../geoTransforms. Aucun codec propre à poi.

// ── Enregistrement des CLÉS référencées par `spec.ts` (descripteur + fns costum) ───────────────────────────
// Le payload (add ET edit) passe par le PIPELINE générique (défaut du résolveur) → AUCUN payloadFn custom requis.
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
