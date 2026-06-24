/**
 * Descripteur POI équipement (costum equipementsSportifs974) — UNIFIÉ render + pipeline (read/write),
 * config-convertible (cf. tiers-lieu). Consommé par le moteur générique `modules/formEngine` :
 *  - RENDU : widgets + sections (wizard) + conditionnel + computed (GenericForm).
 *  - READ/WRITE : `read`/`write`/`default`/`group` par champ + `serializeGroups.address`, exécutés par le
 *    pipeline (seedEntity/buildPayload/buildEditPayload via POI_SPEC dans costum/equipements-sportifs/fns.ts).
 * cf. doc/refactor-field-treatment.md (P2) + doc/moteur-formulaire-generique.md.
 *
 * LEAF (aucun import de poiEquipement.ts → pas de cycle ESM) : les transforms `poi:*` / `geo:*` sont
 * enregistrés au runtime par fns.ts (qui importe CE descripteur pour POI_SPEC) ; ici on ne
 * référence que leurs CLÉS string. Les libellés d'étape sont inlinés (= STEP_TITLE_KEYS).
 *
 * Mise en page fidèle au base form (`PoiEquipementForm`) via les GROUPES : grilles 2/3 colonnes +
 * sous-blocs à titre conditionnels (« Accessibilité PMR/PSHS »). Enums dynamiques via
 * `serverData.lists[<name>]` (passé en `listsOptions`). Computed : equip_surf = equip_long × equip_larg.
 */
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

// Petits constructeurs : widget + READ par TYPE (coercion serveur → form) + défaut typé.
// Les buckets de read correspondent EXACTEMENT à l'ancien buildPoiFields (parité byte) :
// string → coerce:string (""), boolean → coerce:bool (false), number → coerce:number (pas de défaut),
// array → coerce:stringArray ([]), date → coerce:dateYMD ("").
const text = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({ name, type: "string", widget: "text", label: L(name), read: "coerce:string", default: "", ...extra });
const sel = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({ name, type: "string", widget: "selectFromLists", label: L(name), placeholder: L(name), placeholderSearch: "AddPoiEquipement.placeholders.search", read: "coerce:string", default: "", ...extra });
const sw = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({ name, type: "boolean", widget: "switch", label: L(name), read: "coerce:bool", default: false, ...extra });
const date = (name: string): FieldDescriptor => ({ name, type: "date", widget: "date", label: L(name), read: "coerce:dateYMD", default: "" });
const num = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({ name, type: "number", widget: "number", label: L(name), read: "coerce:number", ...extra });
const cbg = (name: string): FieldDescriptor => ({ name, type: "array", widget: "checkboxGroup", label: L(name), read: "coerce:stringArray", default: [] });
const hidden = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({ name, type: "string", widget: "hidden", label: name, ...extra });

const VIS_PMR = { field: "equip_pmr_acc", op: "truthy" } as const;

const fields: FieldDescriptor[] = [
  // ── caché : bloc adresse (groupe de sérialisation "address") ──
  // NB : `type` n'est PLUS un champ — c'est un STAMP costum posé au CREATE via
  // `spec.mutation.inject.extraFields` ({ type: "recoveryCenter" }). En édition il n'est ni relu ni
  // réémis → l'entité conserve son type (Object.assign ne touche pas une clé absente). cf. costum stamp.
  // Membres plats du groupe `address` : recomposés en objet par serializeGroups (pas de read/default
  // individuel — addressCountry retombe sur "RE" via le transform poi:addressRead). localityId pilote
  // l'écriture (clé omise sans lui) ; non rendu (absent des sections) = pipeline-only.
  hidden("addressCountry", { required: true, group: "address" }),
  hidden("addressLocality", { required: true, group: "address" }),
  hidden("postalCode", { required: true, group: "address" }),
  hidden("streetAddress", { required: true, group: "address" }),
  hidden("localityId", { group: "address" }),

  // ── pipeline-only (lus/écrits, non rendus dans aucune section) ──
  hidden("description", { read: "coerce:string", default: "" }),
  { name: "tags", type: "array", widget: "hidden", label: "tags", read: "coerce:stringArray", default: [] },
  // geo/geoPosition : writeOnly (posés par EditLocationTab AVEC l'adresse, jamais relus du form) →
  // émis au WRITE via transforms partagés (geo:write/geoPosition:write, liés à localityId), ignorés au READ.
  { name: "geo", type: "object", widget: "hidden", label: "geo", writeOnly: true, write: "geo:write" },
  { name: "geoPosition", type: "object", widget: "hidden", label: "geoPosition", writeOnly: true, write: "geoPosition:write" },

  // ── général ──
  text("name", { required: true, info: "ProfileEdit.fields.name.description" }),
  sel("equip_type_name", { required: true }),
  sel("equip_type_famille"),
  // Composites de RENDU (renderOnly) : pilotés par le widget image / EditLocationTab — jamais lus ni écrits
  // par le pipeline (l'image est repassée à part par la modale ; l'adresse passe par serializeGroups).
  { name: "_imageFile", type: "object", widget: "image", label: L("image"), renderOnly: true },
  { name: "address", type: "object", widget: "location", label: L("address"), renderOnly: true },

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
    widgetProps: { searchable: false }, visibleIf: { field: "inst_part_bool", op: "truthy" },
    read: "coerce:stringArray", default: [] },

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
    widgetProps: { addLabel: "AddPoiEquipement.buttons.addUrl", removeLabel: "AddPoiEquipement.buttons.removeUrl" },
    read: "coerce:stringArray", default: [] },
  cbg("equip_utilisateur"),
  sw("equip_acc_libre"),
  { name: "aps_name", type: "array", widget: "multiselect", label: L("aps_name"), required: true,
    placeholder: "AddPoiEquipement.placeholders.selectSport", placeholderSearch: "AddPoiEquipement.placeholders.searchSport",
    read: "coerce:stringArray", default: [] },
];

export const equipementsSportifsDescriptor: FormDescriptor = {
  id: "equipements-sportifs",
  collection: "poi",
  costumSlug: "equipementsSportifs974",
  layout: { kind: "wizard", validatePerStep: true },
  // Groupe de sérialisation : objet serveur `address` ↔ champs plats du form (read = décompose 14 clés,
  // write = recompose, undefined si pas de localityId → clé omise). Parité buildEditDefaults / buildAddressFromForm.
  serializeGroups: { address: { serverKey: "address", read: "poi:addressRead", write: "poi:addressWrite" } },
  sections: [
    {
      id: "general", label: "AddPoiEquipement.steps.general",
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
      id: "legal", label: "AddPoiEquipement.steps.legal",
      groups: [
        { columns: 2, fields: ["equip_prop_nom", "equip_prop_type"] },
        { columns: 3, fields: ["inst_date_creation", "inst_enqu_date", "equip_maj_date"] },
        { columns: 1, fields: ["inst_nom", "categorie", "equip_gest_type"] },
        { columns: 1, fields: ["inst_part_bool", "inst_part_type"] },
      ],
    },
    {
      id: "structure", label: "AddPoiEquipement.steps.structure",
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
      id: "usage", label: "AddPoiEquipement.steps.usage",
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
