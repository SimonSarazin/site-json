/**
 * Document FUSIONNÉ (form + modal) du costum « équipements sportifs » (POI SSBE, equipementsSportifs974).
 * SOURCE UNIQUE : chaque nom de champ n'apparaît que 2× — sa DÉCLARATION (`fields`, widget-driven) et son
 * PLACEMENT (`sections`). type/read/default sont DÉRIVÉS du widget par `compileCostumSchema` (cf. ce module) ;
 * le code irréductible (transforms `poi:*`/`geo:*`/`address:*`, scope, slots, payload, invalidate) est
 * référencé PAR CLÉ string et enregistré dans `./fns`. Posable tel quel dans la config globale JSON.
 *
 * `descriptor.ts` / `spec.ts` ne font plus que DÉRIVER de ce document (`compileCostumSchema(...).descriptor`
 * / `.spec`). Byte-parité figée par `compiled.byteparity.test` (snapshot) + `equipements-sportifs.configDriven`
 * + `defaults.byteparity` + `spec.test`. cf. plan fusion `~/.claude/plans/streamed-snuggling-glacier.md`.
 */
import type { CostumFormSchema } from "../compileCostumSchema";

export const EQUIPEMENTS_SPORTIFS_SCHEMA: CostumFormSchema = {
  id: "equipements-sportifs",
  entityType: "poi",
  costumSlug: "equipementsSportifs974",
  layout: { kind: "wizard", validatePerStep: true },
  // Groupe de sérialisation `address` (objet serveur ↔ 14 clés plates) — codec COMMUN `address:read` + poi:addressWrite.
  serializeGroups: { address: { serverKey: "address", read: "address:read", write: "poi:addressWrite" } },
  // Défaut par widget : la zone de recherche des selects (placeholder = label, posé par le compilateur).
  fieldPresets: { selectFromLists: { placeholderSearch: "AddPoiEquipement.placeholders.search" } },

  // ── CHAMPS : déclarés une seule fois (widget + overrides). type/read/default DÉRIVÉS du widget. ──
  fields: {
    // adresse (groupe `address`) : cachés, recomposés en objet serveur ; label ⇐ nom.
    addressCountry: { widget: "hidden", required: true, group: "address" },
    addressLocality: { widget: "hidden", required: true, group: "address" },
    postalCode: { widget: "hidden", required: true, group: "address" },
    streetAddress: { widget: "hidden", required: true, group: "address" },
    localityId: { widget: "hidden", group: "address" },
    // pipeline-only (lus/écrits, non rendus) ; geo/geoPosition writeOnly (posés par EditLocationTab).
    description: { widget: "hidden", read: "coerce:string", default: "" },
    tags: { widget: "hidden", type: "array", read: "coerce:stringArray", default: [] },
    geo: { widget: "hidden", type: "object", writeOnly: true, write: "geo:write" },
    geoPosition: { widget: "hidden", type: "object", writeOnly: true, write: "geoPosition:write" },

    // général
    name: { widget: "text", required: true, label: "ProfileEdit.fields.name.label", info: "ProfileEdit.fields.name.description" },
    equip_type_name: { widget: "selectFromLists", required: true, label: "AddPoiEquipement.fields.equipTypeName" },
    equip_type_famille: { widget: "selectFromLists", label: "AddPoiEquipement.fields.equipTypeFamille" },
    _imageFile: { widget: "image", label: "image" },
    address: { widget: "location", label: "AddPoiEquipement.fields.address" },

    // juridique
    equip_prop_nom: { widget: "text", label: "AddPoiEquipement.fields.proprietaireNom" },
    equip_prop_type: { widget: "selectFromLists", label: "AddPoiEquipement.fields.proprietaireType" },
    inst_date_creation: { widget: "date", label: "AddPoiEquipement.fields.dateCreation" },
    inst_enqu_date: { widget: "date", label: "AddPoiEquipement.fields.dateEnquete" },
    equip_maj_date: { widget: "date", label: "AddPoiEquipement.fields.dateMaj" },
    inst_nom: { widget: "text", label: "AddPoiEquipement.fields.institutionNom" },
    categorie: { widget: "text", label: "AddPoiEquipement.fields.categorie" },
    equip_gest_type: { widget: "text", label: "AddPoiEquipement.fields.gestionnaireType" },
    inst_part_bool: { widget: "switch", label: "AddPoiEquipement.fields.partenariatDisponible" },
    inst_part_type: { widget: "tags", label: "AddPoiEquipement.fields.partenariatType", widgetProps: { searchable: false }, visibleIf: { field: "inst_part_bool", op: "truthy" } },

    // structurant
    equip_nature: { widget: "selectFromLists", label: "AddPoiEquipement.fields.nature" },
    equip_sol: { widget: "selectFromLists", label: "AddPoiEquipement.fields.sol" },
    equip_long: { widget: "number", label: "AddPoiEquipement.fields.longueur" },
    equip_larg: { widget: "number", label: "AddPoiEquipement.fields.largeur" },
    equip_surf: { widget: "number", label: "AddPoiEquipement.fields.surface", computedFrom: { deps: ["equip_long", "equip_larg"], fn: "multiply" } },
    inst_acc_handi_type: { widget: "text", label: "AddPoiEquipement.fields.handicapType" },
    inst_trans_type: { widget: "text", label: "AddPoiEquipement.fields.transportType" },
    inst_acc_handi_bool: { widget: "switch", label: "AddPoiEquipement.fields.accessibleHandicap" },
    inst_trans_bool: { widget: "switch", label: "AddPoiEquipement.fields.accessibleTransport" },
    equip_eclair: { widget: "switch", label: "AddPoiEquipement.fields.eclairage" },
    equip_douche: { widget: "switch", label: "AddPoiEquipement.fields.doucheAccessible" },
    equip_pmr_acc: { widget: "switch", label: "AddPoiEquipement.fields.pmrAcces" },
    equip_pmr_chem: { widget: "switch", label: "AddPoiEquipement.fields.pmrChem" },
    equip_pmr_douche: { widget: "switch", label: "AddPoiEquipement.fields.pmrDouche" },
    equip_pmr_trib: { widget: "switch", label: "AddPoiEquipement.fields.pmrTrib" },
    equip_pmr_vest: { widget: "switch", label: "AddPoiEquipement.fields.pmrVest" },
    equip_pmr_sanit: { widget: "switch", label: "AddPoiEquipement.fields.pmrSanit" },
    equip_loc_type: { widget: "checkboxGroup", label: "AddPoiEquipement.fields.locauxComplementaires" },
    equip_pshs_aire: { widget: "switch", label: "AddPoiEquipement.pshs.aire" },
    equip_pshs_sanit: { widget: "switch", label: "AddPoiEquipement.pshs.sanit" },
    equip_pshs_trib: { widget: "switch", label: "AddPoiEquipement.pshs.trib" },
    equip_pshs_sign: { widget: "switch", label: "AddPoiEquipement.pshs.sign" },
    equip_pshs_vest: { widget: "switch", label: "AddPoiEquipement.pshs.vest" },
    equip_pshs_chem: { widget: "switch", label: "AddPoiEquipement.pshs.chem" },

    // usages
    urls: { widget: "urlList", label: "AddPoiEquipement.fields.siteInternet", widgetProps: { addLabel: "AddPoiEquipement.buttons.addUrl", removeLabel: "AddPoiEquipement.buttons.removeUrl" } },
    equip_utilisateur: { widget: "checkboxGroup", label: "AddPoiEquipement.fields.typesUtilisateurs" },
    equip_acc_libre: { widget: "switch", label: "AddPoiEquipement.fields.accesLibre" },
    aps_name: { widget: "multiselect", required: true, label: "AddPoiEquipement.fields.sportsPratiques", placeholder: "AddPoiEquipement.placeholders.selectSport", placeholderSearch: "AddPoiEquipement.placeholders.searchSport" },
  },

  // ── PLACEMENT (wizard) : ordre / colonnes / sous-blocs conditionnels ──
  sections: [
    { id: "general", label: "AddPoiEquipement.steps.general", groups: [
      { columns: 1, fields: ["$slot:parentInfo", "name"] },
      { columns: 2, fields: ["equip_type_name", "equip_type_famille"] },
      { columns: 1, fields: ["_imageFile"] },
      { columns: 1, label: "AddPoiEquipement.fields.address", required: true, fields: ["address", "addressCountry", "addressLocality", "postalCode", "streetAddress"] },
      { columns: 1, fields: ["$slot:doublons"] },
    ] },
    { id: "legal", label: "AddPoiEquipement.steps.legal", groups: [
      { columns: 2, fields: ["equip_prop_nom", "equip_prop_type"] },
      { columns: 3, fields: ["inst_date_creation", "inst_enqu_date", "equip_maj_date"] },
      { columns: 1, fields: ["inst_nom", "categorie", "equip_gest_type"] },
      { columns: 1, fields: ["inst_part_bool", "inst_part_type"] },
    ] },
    { id: "structure", label: "AddPoiEquipement.steps.structure", groups: [
      { columns: 2, fields: ["equip_nature", "equip_sol"] },
      { columns: 3, fields: ["equip_long", "equip_larg", "equip_surf"] },
      { columns: 2, fields: ["inst_acc_handi_type", "inst_trans_type"] },
      { columns: 2, fields: ["inst_acc_handi_bool", "inst_trans_bool", "equip_eclair", "equip_douche"] },
      { columns: 1, fields: ["equip_pmr_acc"] },
      { columns: 2, label: "AddPoiEquipement.sections.pmr", visibleIf: { field: "equip_pmr_acc", op: "truthy" },
        fields: ["equip_pmr_chem", "equip_pmr_douche", "equip_pmr_trib", "equip_pmr_vest", "equip_pmr_sanit"] },
      { columns: 1, fields: ["equip_loc_type"] },
      { columns: 2, label: "AddPoiEquipement.sections.pshs",
        fields: ["equip_pshs_aire", "equip_pshs_sanit", "equip_pshs_trib", "equip_pshs_sign", "equip_pshs_vest", "equip_pshs_chem"] },
    ] },
    { id: "usage", label: "AddPoiEquipement.steps.usage", groups: [
      { columns: 1, fields: ["urls"] },
      { columns: 1, fields: ["equip_utilisateur"] },
      { columns: 1, fields: ["equip_acc_libre"] },
      { columns: 1, fields: ["aps_name"] },
    ] },
  ],

  // ── MODAL ──
  chrome: {
    title: { add: "AddPoiEquipement.title.add", edit: "AddPoiEquipement.title.edit" },
    description: { add: "AddPoiEquipement.description.add", edit: "AddPoiEquipement.description.edit" },
    submitLabel: { add: "AddEntity.create", edit: "ProfileEdit.save" },
    dialogClassName: "sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden",
    validationFailedKey: "AddPoiEquipement.validationFailed",
    navText: {
      next: "AddPoiEquipement.buttons.next",
      previous: "AddPoiEquipement.buttons.previous",
      cancel: "common.cancel",
      stepLabelKey: "AddPoiEquipement.stepIndicator",
    },
  },
  image: { field: "_imageFile", existingUrlFrom: "image:profilUrl" },
  listsFromCarrier: true,
  // Scope du costum = DONNÉE (parentId/sourceKey surchargés par le carrier live ; poiType/addressCountry = SSBE/974).
  scope: {
    derive: "poi:scope", slugFrom: "derived", slugKey: "sourceKey",
    defaults: { parentId: "6a04155ed047177b92399685", sourceKey: "equipementsSportifs974", poiType: "recoveryCenter", addressCountry: "RE" },
  },
  defaultsBase: "poi:emptyDefaults",
  slots: { parentInfo: "parentInfo", doublons: "poiDoublons" },
  cleanValues: "poi:dropEmptyUrls",
  mutation: {
    entityType: "poi",
    payloadEmitEmptyOnEdit: true, // édition = pipeline emitEmpty:true ; création = emitEmpty:false (défaut)
    // STAMP costum : `type` tiré du SCOPE (single-source scope.defaults.poiType), au CREATE seulement.
    inject: { parent: true, extraFieldsFromScope: { type: "poiType" } },
    navigateOnSuccess: false,
    successKey: { add: "toast.add.poiSuccess", edit: "toast.profile.updateSuccess" },
    errorKey: { add: "toast.add.poiError", edit: "toast.profile.updateError" },
    errorContext: { add: "EntityFormModal · ADD_POI", edit: "EntityFormModal · UPDATE_POI" },
    invalidateFn: "poi:invalidate",
  },
};
