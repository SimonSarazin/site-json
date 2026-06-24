/**
 * `EntityModalSpec` du costum tiers-lieu (FranceTiersLieux) — 100 % DONNÉES + CLÉS. Remplace
 * `configs/tiersLieu.tsx`. Code référencé par clé enregistré dans `./fns` : descripteur `tiers-lieu`,
 * scope `tl:scope` (slug porteur), defaults `tl:emptyDefaults`, payload `tl:payload` (merge tags costum +
 * extraData), `tl:invalidate`. `image:profilUrl` partagé (enregistré par poiEquipement/fns).
 */
import type { EntityModalSpec } from "../../entityModalSpec";

export const tiersLieuSpec: EntityModalSpec = {
  id: "tiers-lieu",
  descriptor: { ref: "tiers-lieu" },
  title: { add: "AddTiersLieux.title", edit: "EditTiersLieux.title" },
  submitLabel: { add: "AddTiersLieux.buttons.submit", edit: "EditTiersLieux.buttons.submit" },
  icon: "building-2",
  gradientHeader: true,
  dialogClassName: "sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden",
  validationFailedKey: "AddTiersLieux.errors.validationFailed",
  image: { field: "_logoFile", existingUrlFrom: "image:profilUrl" },
  scope: { derive: "tl:scope", slugFrom: "derived", slugKey: "slug" },
  defaults: { base: "tl:emptyDefaults" },
  navText: {
    next: "AddTiersLieux.buttons.next",
    previous: "AddTiersLieux.buttons.previous",
    cancel: "AddTiersLieux.buttons.cancel",
    stepTemplate: { stepKey: "AddTiersLieux.step", ofKey: "AddTiersLieux.stepOf" },
  },
  mutation: {
    entityType: "organizations",
    payloadFn: "tl:payload",
    payloadEmitEmptyOnEdit: true, // (informatif : tl:payload gère lui-même complete:true en édition)
    successKey: { add: "AddTiersLieux.toast.success", edit: "EditTiersLieux.toast.success" },
    errorKey: { add: "AddTiersLieux.toast.error", edit: "EditTiersLieux.toast.error" },
    errorContext: { add: "EntityFormModal · ADD_TIERSLIEU", edit: "EntityFormModal · EDIT_TIERSLIEU" },
    invalidateFn: "tl:invalidate",
  },
};
