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
  // Scope du costum = DONNÉE de config (ex-DEFAULT_POI_EQUIPEMENT_SCOPE, retiré de fns.ts). parentId/sourceKey
  // sont surchargés par le carrier live ; poiType/addressCountry sont les constantes de déploiement (SSBE/974).
  scope: {
    derive: "poi:scope", slugFrom: "derived", slugKey: "sourceKey",
    defaults: { parentId: "6a04155ed047177b92399685", sourceKey: "equipementsSportifs974", poiType: "recoveryCenter", addressCountry: "RE" },
  },
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
