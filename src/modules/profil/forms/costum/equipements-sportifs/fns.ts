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
import { ParentInfoReadonly } from "../../../components/profile-edit/fields";
import { PoiEquipementDoublonsSlot } from "../../PoiEquipementDoublonsSlot";
import type { EntityModalCtx } from "../../entityModalSpec";
import { carrierSlug, type CarrierLike } from "../carrier";
import { registerDescriptor, registerScopeFn, registerDefaultsFn, registerSlot } from "../../specRegistries";
import "../sharedFns"; // side-effect : enregistre les clés communes image:profilUrl + cleanValues/invalidate génériques


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

/**
 * Résout le scope : `parentId`/`sourceKey` LUS du carrier live (id + slug, via `carrierSlug`),
 * `poiType`/`addressCountry` = les constantes de config. Si le carrier est absent, parentId/sourceKey sont vides
 * (la modale n'a pas lieu d'être ouverte hors contexte costum) — pas de fallback en dur sur un id de déploiement.
 */
export function resolvePoiEquipementScope(entity: CarrierLike, defaults: PoiEquipementScopeDefaults): PoiEquipementScope {
  return {
    parentId: entity?.id ?? "",
    sourceKey: carrierSlug(entity),
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
registerScopeFn("poi:scope", (carrier, defaults) =>
  resolvePoiEquipementScope(carrier, {
    poiType: String(defaults?.poiType ?? ""),
    addressCountry: String(defaults?.addressCountry ?? ""),
  }),
);
registerDefaultsFn("poi:emptyDefaults", (ctx) => createEmptyDefaults(ctx.scope as PoiEquipementScope) as unknown as Record<string, unknown>);
registerSlot("parentInfo", (ctx: EntityModalCtx) => createElement(ParentInfoReadonly, { parent: ctx.parent ?? null }));
registerSlot("poiDoublons", (ctx: EntityModalCtx) => createElement(PoiEquipementDoublonsSlot, { scope: ctx.scope as PoiEquipementScope }));
// poi:dropEmptyUrls SUPPRIMÉ → clé générique `cleanValues:dropEmptyArrayItems` (sharedFns) + params {fields:["urls"]} dans le schéma.
// image:profilUrl : clé COMMUNE enregistrée dans ../sharedFns (importé en side-effect ci-dessous).
// poi:invalidate SUPPRIMÉ → clé générique `invalidate:standard` (sharedFns) + params {userList:"pois",
// parentAboutOnAdd:true, searchKeys:[...]} dans le schéma.
