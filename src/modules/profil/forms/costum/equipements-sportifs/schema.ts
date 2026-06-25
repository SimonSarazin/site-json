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

/** Libellé bilingue inline (LocalizedString) — résolu locale-aware au rendu par useT (cf. EntityFormModal). */
const L = (fr: string, en: string) => ({ fr, en });

export const EQUIPEMENTS_SPORTIFS_SCHEMA: CostumFormSchema = {
  id: "equipements-sportifs",
  entityType: "poi",
  costumSlug: "equipementsSportifs974",
  layout: { kind: "wizard", validatePerStep: true },
  // Groupe de sérialisation `address` (objet serveur ↔ 14 clés plates) — codec COMMUN `address:read` + poi:addressWrite.
  serializeGroups: { address: { serverKey: "address", read: "address:read", write: "address:write" } },
  // Défaut par widget : la zone de recherche des selects (placeholder = label, posé par le compilateur).
  fieldPresets: { selectFromLists: { placeholderSearch: L("Rechercher…", "Search…") } },

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
    name: { widget: "text", required: true, label: L("Nom", "Name"), info: L("Le nom qui sera affiché publiquement", "The name that will be publicly displayed") },
    equip_type_name: { widget: "selectFromLists", required: true, label: L("Type de l'équipement", "Facility type") },
    equip_type_famille: { widget: "selectFromLists", label: L("Famille d'équipement", "Facility family") },
    _imageFile: { widget: "image", label: "image" }, // littéral hérité (rendu tel quel) — pas une vraie clé i18n ; laissé inchangé (byte-parité)
    address: { widget: "location", label: L("Adresse", "Address") },

    // juridique
    equip_prop_nom: { widget: "text", label: L("Nom du propriétaire", "Owner name") },
    equip_prop_type: { widget: "selectFromLists", label: L("Type de propriétaire", "Owner type") },
    inst_date_creation: { widget: "date", label: L("Date de création", "Creation date") },
    inst_enqu_date: { widget: "date", label: L("Date d'enquête", "Survey date") },
    equip_maj_date: { widget: "date", label: L("Date de mise à jour", "Update date") },
    inst_nom: { widget: "text", label: L("Nom de l'institution", "Institution name") },
    categorie: { widget: "text", label: L("Catégorie", "Category") },
    equip_gest_type: { widget: "text", label: L("Type de gestionnaire", "Manager type") },
    inst_part_bool: { widget: "switch", label: L("Partenariat disponible", "Partnership available") },
    inst_part_type: { widget: "tags", label: L("Type de partenariat", "Partnership type"), widgetProps: { searchable: false }, visibleIf: { field: "inst_part_bool", op: "truthy" } },

    // structurant
    equip_nature: { widget: "selectFromLists", label: L("Nature de l'équipement", "Facility nature") },
    equip_sol: { widget: "selectFromLists", label: L("Type de sol", "Floor type") },
    equip_long: { widget: "number", label: L("Longueur", "Length") },
    equip_larg: { widget: "number", label: L("Largeur", "Width") },
    equip_surf: { widget: "number", label: L("Surface (calculée)", "Area (computed)"), computedFrom: { deps: ["equip_long", "equip_larg"], fn: "multiply" } },
    inst_acc_handi_type: { widget: "text", label: L("Type de handicap pris en charge", "Type of disability supported") },
    inst_trans_type: { widget: "text", label: L("Moyen de transport disponible", "Available means of transport") },
    inst_acc_handi_bool: { widget: "switch", label: L("Accessible aux personnes en situation de handicap", "Accessible to people with disabilities") },
    inst_trans_bool: { widget: "switch", label: L("Accessible en transport en commun", "Accessible by public transport") },
    equip_eclair: { widget: "switch", label: L("Éclairage de l'aire", "Area lighting") },
    equip_douche: { widget: "switch", label: L("Douche accessible", "Accessible shower") },
    equip_pmr_acc: { widget: "switch", label: L("Accès PMR disponible", "PRM access available") },
    equip_pmr_chem: { widget: "switch", label: L("Cheminement PMR adapté", "PRM-adapted pathway") },
    equip_pmr_douche: { widget: "switch", label: L("Douches accessibles PMR", "PRM-accessible showers") },
    equip_pmr_trib: { widget: "switch", label: L("Tribunes accessibles PMR", "PRM-accessible stands") },
    equip_pmr_vest: { widget: "switch", label: L("Vestiaires accessibles PMR", "PRM-accessible changing rooms") },
    equip_pmr_sanit: { widget: "switch", label: L("Sanitaires accessibles PMR", "PRM-accessible toilets") },
    equip_loc_type: { widget: "checkboxGroup", label: L("Locaux complémentaires", "Additional premises") },
    equip_pshs_aire: { widget: "switch", label: L("Aire de jeu", "Play area") },
    equip_pshs_sanit: { widget: "switch", label: L("Sanitaires", "Toilets") },
    equip_pshs_trib: { widget: "switch", label: L("Tribunes", "Stands") },
    equip_pshs_sign: { widget: "switch", label: L("Accueil / Signalétique", "Reception / Signage") },
    equip_pshs_vest: { widget: "switch", label: L("Vestiaires", "Changing rooms") },
    equip_pshs_chem: { widget: "switch", label: L("Cheminements", "Pathways") },

    // usages
    urls: { widget: "urlList", label: L("Site internet", "Website"), widgetProps: { addLabel: L("Ajouter une URL", "Add a URL"), removeLabel: L("Retirer l'URL", "Remove URL") } },
    equip_utilisateur: { widget: "checkboxGroup", label: L("Types d'utilisateurs", "User types") },
    equip_acc_libre: { widget: "switch", label: L("Accès libre", "Free access") },
    aps_name: { widget: "multiselect", required: true, label: L("Sports pratiqués", "Sports practised"), placeholder: L("Sélectionner un sport", "Select a sport"), placeholderSearch: L("Rechercher un sport", "Search a sport") },
  },

  // ── PLACEMENT (wizard) : ordre / colonnes / sous-blocs conditionnels ──
  sections: [
    { id: "general", label: L("Informations générales", "General information"), groups: [
      { columns: 1, fields: ["$slot:parentInfo", "name"] },
      { columns: 2, fields: ["equip_type_name", "equip_type_famille"] },
      { columns: 1, fields: ["_imageFile"] },
      { columns: 1, label: L("Adresse", "Address"), required: true, fields: ["address", "addressCountry", "addressLocality", "postalCode", "streetAddress"] },
      { columns: 1, fields: ["$slot:doublons"] },
    ] },
    { id: "legal", label: L("Caractéristiques juridiques", "Legal characteristics"), groups: [
      { columns: 2, fields: ["equip_prop_nom", "equip_prop_type"] },
      { columns: 3, fields: ["inst_date_creation", "inst_enqu_date", "equip_maj_date"] },
      { columns: 1, fields: ["inst_nom", "categorie", "equip_gest_type"] },
      { columns: 1, fields: ["inst_part_bool", "inst_part_type"] },
    ] },
    { id: "structure", label: L("Caractéristiques structurantes", "Structural characteristics"), groups: [
      { columns: 2, fields: ["equip_nature", "equip_sol"] },
      { columns: 3, fields: ["equip_long", "equip_larg", "equip_surf"] },
      { columns: 2, fields: ["inst_acc_handi_type", "inst_trans_type"] },
      { columns: 2, fields: ["inst_acc_handi_bool", "inst_trans_bool", "equip_eclair", "equip_douche"] },
      { columns: 1, fields: ["equip_pmr_acc"] },
      { columns: 2, label: L("Accessibilité PMR", "PRM accessibility"), visibleIf: { field: "equip_pmr_acc", op: "truthy" },
        fields: ["equip_pmr_chem", "equip_pmr_douche", "equip_pmr_trib", "equip_pmr_vest", "equip_pmr_sanit"] },
      { columns: 1, fields: ["equip_loc_type"] },
      { columns: 2, label: L("Accessibilité PSHS", "PSHS accessibility"),
        fields: ["equip_pshs_aire", "equip_pshs_sanit", "equip_pshs_trib", "equip_pshs_sign", "equip_pshs_vest", "equip_pshs_chem"] },
    ] },
    { id: "usage", label: L("Caractéristiques d'usages", "Usage characteristics"), groups: [
      { columns: 1, fields: ["urls"] },
      { columns: 1, fields: ["equip_utilisateur"] },
      { columns: 1, fields: ["equip_acc_libre"] },
      { columns: 1, fields: ["aps_name"] },
    ] },
  ],

  // ── MODAL ──
  chrome: {
    title: { add: L("Ajouter un équipement", "Add a facility"), edit: L("Éditer un équipement", "Edit a facility") },
    description: { add: L("Compléter les informations de l'équipement.", "Fill in the facility information."), edit: L("Mettre à jour les informations de l'équipement.", "Update the facility information.") },
    submitLabel: { add: L("Créer", "Create"), edit: L("Sauvegarder", "Save") },
    dialogClassName: "sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden",
    validationFailedKey: L("Veuillez corriger les champs en erreur.", "Please fix the highlighted fields."),
    navText: {
      next: L("Suivant", "Next"),
      previous: L("Précédent", "Previous"),
      cancel: L("Annuler", "Cancel"),
      stepLabelKey: "AddPoiEquipement.stepIndicator", // INTERPOLÉ {index}/{total} → reste une clé i18next (useLocalization n'interpole pas)
    },
  },
  image: { field: "_imageFile", existingUrlFrom: "image:profilUrl" },
  listsFromCarrier: true,
  // Scope du costum : parentId/sourceKey LUS du carrier live (slugKey "sourceKey") ; defaults = SEULES les
  // constantes de domaine SSBE (poiType/addressCountry) — plus d'id de déploiement en dur en fallback.
  scope: {
    derive: "poi:scope", slugFrom: "derived", slugKey: "sourceKey",
    defaults: { poiType: "recoveryCenter", addressCountry: "RE" },
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
