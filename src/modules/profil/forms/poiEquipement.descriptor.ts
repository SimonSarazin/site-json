/**
 * Descripteur POI équipement (costum equipementsSportifs974) — couche UI (métier).
 * Consommé par le moteur générique `modules/formEngine`. cf. doc/moteur-formulaire-generique.md.
 *
 * Mise en page fidèle au base form (`PoiEquipementForm`) via les GROUPES du descripteur :
 * grilles 2/3 colonnes + sous-blocs à titre conditionnels (« Accessibilité PMR/PSHS »).
 * - DONNÉES (type/enum) : type déclaré ici ; enums dynamiques (select/checkbox) via
 *   `serverData.lists[<name>]` (passé en `listsOptions` au moteur).
 * - Conditionnel : inst_part_type ⟸ inst_part_bool ; bloc PMR ⟸ equip_pmr_acc (groupe).
 * - Computed : equip_surf = equip_long × equip_larg.
 * - required (zod) : name/type/equip_type_name + adresse (cachée) + aps_name.
 */
import { STEP_TITLE_KEYS } from "../components/add/poiEquipement";
import type { FieldDescriptor, FormDescriptor } from "@/modules/formEngine";

/** champ (nom de stockage) → clé i18n réelle (sémantique, pas le nom brut). cf. PoiEquipementForm. */
const LABELS: Record<string, string> = {
  name: "ProfileEdit.fields.name.label",
  equip_type_name: "AddPoiEquipement.fields.equipTypeName",
  equip_type_famille: "AddPoiEquipement.fields.equipTypeFamille",
  _imageFile: "AddPoiEquipement.fields.image",
  address: "AddPoiEquipement.fields.address",
  equip_prop_nom: "AddPoiEquipement.fields.proprietaireNom",
  equip_prop_type: "AddPoiEquipement.fields.proprietaireType",
  inst_date_creation: "AddPoiEquipement.fields.dateCreation",
  inst_enqu_date: "AddPoiEquipement.fields.dateEnquete",
  equip_maj_date: "AddPoiEquipement.fields.dateMaj",
  inst_nom: "AddPoiEquipement.fields.institutionNom",
  categorie: "AddPoiEquipement.fields.categorie",
  equip_gest_type: "AddPoiEquipement.fields.gestionnaireType",
  inst_part_bool: "AddPoiEquipement.fields.partenariatDisponible",
  inst_part_type: "AddPoiEquipement.fields.partenariatType",
  equip_nature: "AddPoiEquipement.fields.nature",
  equip_sol: "AddPoiEquipement.fields.sol",
  equip_long: "AddPoiEquipement.fields.longueur",
  equip_larg: "AddPoiEquipement.fields.largeur",
  equip_surf: "AddPoiEquipement.fields.surface",
  inst_acc_handi_type: "AddPoiEquipement.fields.handicapType",
  inst_trans_type: "AddPoiEquipement.fields.transportType",
  inst_acc_handi_bool: "AddPoiEquipement.fields.accessibleHandicap",
  inst_trans_bool: "AddPoiEquipement.fields.accessibleTransport",
  equip_eclair: "AddPoiEquipement.fields.eclairage",
  equip_douche: "AddPoiEquipement.fields.doucheAccessible",
  equip_pmr_acc: "AddPoiEquipement.fields.pmrAcces",
  equip_pmr_chem: "AddPoiEquipement.fields.pmrChem",
  equip_pmr_douche: "AddPoiEquipement.fields.pmrDouche",
  equip_pmr_trib: "AddPoiEquipement.fields.pmrTrib",
  equip_pmr_vest: "AddPoiEquipement.fields.pmrVest",
  equip_pmr_sanit: "AddPoiEquipement.fields.pmrSanit",
  equip_loc_type: "AddPoiEquipement.fields.locauxComplementaires",
  urls: "AddPoiEquipement.fields.siteInternet",
  equip_utilisateur: "AddPoiEquipement.fields.typesUtilisateurs",
  equip_acc_libre: "AddPoiEquipement.fields.accesLibre",
  aps_name: "AddPoiEquipement.fields.sportsPratiques",
  equip_pshs_aire: "AddPoiEquipement.pshs.aire",
  equip_pshs_sanit: "AddPoiEquipement.pshs.sanit",
  equip_pshs_trib: "AddPoiEquipement.pshs.trib",
  equip_pshs_sign: "AddPoiEquipement.pshs.sign",
  equip_pshs_vest: "AddPoiEquipement.pshs.vest",
  equip_pshs_chem: "AddPoiEquipement.pshs.chem",
};
const L = (name: string) => LABELS[name] ?? name;

// petits constructeurs pour limiter le bruit
const text = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({ name, type: "string", widget: "text", label: L(name), ...extra });
const sel = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({ name, type: "string", widget: "selectFromLists", label: L(name), placeholder: L(name), placeholderSearch: "AddPoiEquipement.placeholders.search", ...extra });
const sw = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({ name, type: "boolean", widget: "switch", label: L(name), ...extra });
const date = (name: string): FieldDescriptor => ({ name, type: "date", widget: "date", label: L(name) });
const num = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({ name, type: "number", widget: "number", label: L(name), ...extra });
const cbg = (name: string): FieldDescriptor => ({ name, type: "array", widget: "checkboxGroup", label: L(name) });
const hidden = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({ name, type: "string", widget: "hidden", label: name, ...extra });

const VIS_PMR = { field: "equip_pmr_acc", op: "truthy" } as const;

const fields: FieldDescriptor[] = [
  // ── caché : type (vient du scope) + bloc adresse (écrit par EditLocationTab) ──
  hidden("type", { required: true }),
  hidden("addressCountry", { required: true }),
  hidden("addressLocality", { required: true }),
  hidden("postalCode", { required: true }),
  hidden("streetAddress", { required: true }),

  // ── général ──
  text("name", { required: true, info: "ProfileEdit.fields.name.description" }),
  sel("equip_type_name", { required: true }),
  sel("equip_type_famille"),
  { name: "_imageFile", type: "object", widget: "image", label: L("image") },
  { name: "address", type: "object", widget: "location", label: L("address") },

  // ── juridique ──
  text("equip_prop_nom"),
  sel("equip_prop_type"),
  date("inst_date_creation"),
  date("inst_enqu_date"),
  date("equip_maj_date"),
  text("inst_nom"),
  text("categorie"),
  text("equip_gest_type"),
  sw("inst_part_bool"),
  { name: "inst_part_type", type: "array", widget: "tags", label: L("inst_part_type"),
    widgetProps: { searchable: false }, visibleIf: { field: "inst_part_bool", op: "truthy" } },

  // ── structurant ──
  sel("equip_nature"),
  sel("equip_sol"),
  num("equip_long"),
  num("equip_larg"),
  num("equip_surf", { computedFrom: { deps: ["equip_long", "equip_larg"], fn: "multiply" } }),
  text("inst_acc_handi_type"),
  text("inst_trans_type"),
  sw("inst_acc_handi_bool"),
  sw("inst_trans_bool"),
  sw("equip_eclair"),
  sw("equip_douche"),
  sw("equip_pmr_acc"),
  // bloc PMR : conditionné par le GROUPE (visibleIf), pas champ par champ.
  sw("equip_pmr_chem"),
  sw("equip_pmr_douche"),
  sw("equip_pmr_trib"),
  sw("equip_pmr_vest"),
  sw("equip_pmr_sanit"),
  cbg("equip_loc_type"),
  sw("equip_pshs_aire"),
  sw("equip_pshs_sanit"),
  sw("equip_pshs_trib"),
  sw("equip_pshs_sign"),
  sw("equip_pshs_vest"),
  sw("equip_pshs_chem"),

  // ── usages ──
  { name: "urls", type: "array", widget: "urlList", label: L("urls"),
    widgetProps: { addLabel: "AddPoiEquipement.buttons.addUrl", removeLabel: "AddPoiEquipement.buttons.removeUrl" } },
  cbg("equip_utilisateur"),
  sw("equip_acc_libre"),
  { name: "aps_name", type: "array", widget: "multiselect", label: L("aps_name"), required: true,
    placeholder: "AddPoiEquipement.placeholders.selectSport", placeholderSearch: "AddPoiEquipement.placeholders.searchSport" },
];

export const poiEquipementDescriptor: FormDescriptor = {
  id: "poi-equipement",
  collection: "poi",
  costumSlug: "equipementsSportifs974",
  layout: { kind: "wizard", validatePerStep: true },
  sections: [
    {
      id: "general", label: STEP_TITLE_KEYS.general,
      groups: [
        { columns: 1, fields: ["$slot:parentInfo", "name"] },
        { columns: 2, fields: ["equip_type_name", "equip_type_famille"] },
        { columns: 1, fields: ["_imageFile"] },
        // bloc adresse (titre requis + EditLocationTab) ; les sous-champs cachés suivent le composite.
        { columns: 1, label: L("address"), required: true, fields: ["address", "addressCountry", "addressLocality", "postalCode", "streetAddress"] },
        { columns: 1, fields: ["$slot:doublons"] },
      ],
    },
    {
      id: "legal", label: STEP_TITLE_KEYS.legal,
      groups: [
        { columns: 2, fields: ["equip_prop_nom", "equip_prop_type"] },
        { columns: 3, fields: ["inst_date_creation", "inst_enqu_date", "equip_maj_date"] },
        { columns: 1, fields: ["inst_nom", "categorie", "equip_gest_type"] },
        { columns: 1, fields: ["inst_part_bool", "inst_part_type"] },
      ],
    },
    {
      id: "structure", label: STEP_TITLE_KEYS.structure,
      groups: [
        { columns: 2, fields: ["equip_nature", "equip_sol"] },
        { columns: 3, fields: ["equip_long", "equip_larg", "equip_surf"] },
        { columns: 2, fields: ["inst_acc_handi_type", "inst_trans_type"] },
        { columns: 2, fields: ["inst_acc_handi_bool", "inst_trans_bool", "equip_eclair", "equip_douche"] },
        { columns: 1, fields: ["equip_pmr_acc"] },
        { columns: 2, label: "AddPoiEquipement.sections.pmr", visibleIf: VIS_PMR,
          fields: ["equip_pmr_chem", "equip_pmr_douche", "equip_pmr_trib", "equip_pmr_vest", "equip_pmr_sanit"] },
        { columns: 1, fields: ["equip_loc_type"] },
        { columns: 2, label: "AddPoiEquipement.sections.pshs",
          fields: ["equip_pshs_aire", "equip_pshs_sanit", "equip_pshs_trib", "equip_pshs_sign", "equip_pshs_vest", "equip_pshs_chem"] },
      ],
    },
    {
      id: "usage", label: STEP_TITLE_KEYS.usage,
      groups: [
        { columns: 1, fields: ["urls"] },
        { columns: 1, fields: ["equip_utilisateur"] },
        { columns: 1, fields: ["equip_acc_libre"] },
        { columns: 1, fields: ["aps_name"] },
      ],
    },
  ],
  fields: Object.fromEntries(fields.map((f) => [f.name, f])),
};
