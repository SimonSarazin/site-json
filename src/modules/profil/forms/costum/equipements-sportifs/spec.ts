/**
 * `EntityModalSpec` du costum poi-équipement (equipementsSportifs974) — 100 % DONNÉES + CLÉS (aucune closure).
 * Remplace `costum/equipements-sportifs/spec.ts`. Le code référencé par clé est enregistré dans `./fns` :
 * descripteur `poi-equipement`, scope `poi:scope`, defaults `poi:emptyDefaults`, slots `parentInfo`/`poiDoublons`,
 * `poi:dropEmptyUrls`, `image:profilUrl`, `poi:invalidate`. Le payload (add+edit) passe par le pipeline (défaut).
 */
import type { EntityModalSpec } from "../../entityModalSpec";

export const equipementsSportifsSpec: EntityModalSpec = {
  id: "equipements-sportifs",
  descriptor: { ref: "equipements-sportifs" },
  title: { add: "AddPoiEquipement.title.add", edit: "AddPoiEquipement.title.edit" },
  description: { add: "AddPoiEquipement.description.add", edit: "AddPoiEquipement.description.edit" },
  submitLabel: { add: "AddEntity.create", edit: "ProfileEdit.save" },
  dialogClassName: "sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden",
  validationFailedKey: "AddPoiEquipement.validationFailed",
  listsFromCarrier: true,
  image: { field: "_imageFile", existingUrlFrom: "image:profilUrl" },
  scope: { derive: "poi:scope", slugFrom: "derived", slugKey: "sourceKey" },
  defaults: { base: "poi:emptyDefaults" },
  navText: {
    next: "AddPoiEquipement.buttons.next",
    previous: "AddPoiEquipement.buttons.previous",
    cancel: "common.cancel",
    stepLabelKey: "AddPoiEquipement.stepIndicator",
  },
  slots: { parentInfo: "parentInfo", doublons: "poiDoublons" },
  cleanValues: "poi:dropEmptyUrls",
  mutation: {
    entityType: "poi",
    payloadEmitEmptyOnEdit: true, // édition = pipeline emitEmpty:true ; création = emitEmpty:false (défaut)
    // STAMP costum : valeurs fixes tamponnées au CREATE (pattern réutilisable). `type` = identité de stockage
    // SSBE (POI type "recoveryCenter"). Au create uniquement (inject) → édition n'y touche pas (préservé).
    inject: { parent: true, extraFields: { type: "recoveryCenter" } },
    navigateOnSuccess: false,
    successKey: { add: "toast.add.poiSuccess", edit: "toast.profile.updateSuccess" },
    errorKey: { add: "toast.add.poiError", edit: "toast.profile.updateError" },
    errorContext: { add: "EntityFormModal · ADD_POI", edit: "EntityFormModal · UPDATE_POI" },
    invalidateFn: "poi:invalidate",
  },
};
