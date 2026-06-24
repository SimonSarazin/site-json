/**
 * Descripteur tiers-lieu (costum navigatorDesTierslieux) — couche UI, consommé par `modules/formEngine`.
 * Pendant générique du `TiersLieuxForm` codé en dur : MÊME organisation de steps (ordre des champs,
 * sous-blocs labellisés, grilles) que l'original — cf. TiersLieuxForm.tsx. Mêmes noms de champs que
 * `TiersLieuxFormData` → READ (`mapEntityToTiersLieuxValues`) et WRITE (`buildTiersLieuxPayload`) inchangés.
 * Layout `tabs`, 5 steps : info / contact / media / online / details.
 */
import type { FieldDescriptor, FormDescriptor } from "@/modules/formEngine";
import "../../validators"; // side-effect : enregistre la clé "addressValid" dans le validateRegistry

const F = (k: string) => `AddTiersLieux.fields.${k}`;

const MANAGEMENT_TYPES = [
  { value: "association", label: "Association" },
  { value: "collectif-citoyen", label: "Collectif citoyen" },
  { value: "universites", label: "Universités / Écoles" },
  { value: "etablissements-scolaires", label: "Établissements scolaires" },
  { value: "collectivites", label: "Collectivités" },
  { value: "sarl-sa-sas", label: "SARL / SA / SAS" },
  { value: "scic", label: "SCIC" },
  { value: "scop", label: "SCOP" },
  { value: "autre", label: "Autre mode de gestion" },
];

const FAMILY_OPTIONS = [
  { value: "ateliers-artisanaux", label: "Ateliers artisanaux partagés" },
  { value: "coworking", label: "Bureaux partagés / Coworking" },
  { value: "foodlab", label: "Cuisine partagée / Foodlab" },
  { value: "fablab", label: "Fablab / Makerspace / Hackerspace" },
  { value: "livinglab", label: "LivingLab / Innovation sociale" },
  { value: "nourricier", label: "Tiers-lieu nourricier" },
  { value: "culturel", label: "Tiers-lieu culturel" },
  { value: "autre", label: "Autre famille de tiers-lieux" },
];

const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook" }, { value: "twitter", label: "Twitter / X" },
  { value: "instagram", label: "Instagram" }, { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" }, { value: "mastodon", label: "Mastodon" },
  { value: "telegram", label: "Telegram" }, { value: "discord", label: "Discord" },
];

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
  .map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));
// Plage identique à l'original : (année courante + 5) → 1900, décroissant.
const NOW_Y = new Date().getFullYear();
const YEARS = Array.from({ length: NOW_Y + 5 - 1900 + 1 }, (_, i) => String(NOW_Y + 5 - i)).map((y) => ({ value: y, label: y }));

const VIS_MGMT_AUTRE = { field: "managementType", op: "eq", value: "autre" } as const;

// DESCRIPTEUR UNIFIÉ render + pipeline : chaque champ porte son widget/layout (RENDER) ET ses transforms
// read/write/path/group (PIPELINE, ex-TIERSLIEU_DESCRIPTOR) → UN seul descripteur consommé par GenericForm
// (render) ET seedFromEntity/valuesToPayload (read/write). Les ancres composites `address` (location, pilote
// les champs plats) et `_logoFile` (image, hors element/save) sont `renderOnly` (ni seedées ni émises).
const fields: FieldDescriptor[] = [
  { name: "name", type: "string", widget: "text", label: F("name"), required: true, placeholder: F("namePlaceholder"), read: "coerce:pickString" },
  // Mois / année SANS label propre : ils vivent sous le titre de GROUPE « Date d'ouverture » (cf. original).
  { name: "openingMonth", type: "string", widget: "select", label: "", enum: MONTHS, placeholder: F("month"), group: "openingDate" },
  { name: "openingYear", type: "string", widget: "select", label: "", enum: YEARS, placeholder: F("year"), group: "openingDate" },
  { name: "shortDescription", type: "string", widget: "textarea", label: F("shortDescription"), required: true, widgetProps: { rows: 2 }, read: "coerce:pickString", write: "coerce:orUndef" },
  { name: "structureName", type: "string", widget: "text", label: F("structureName"), read: "coerce:pickString", write: "coerce:orUndef", path: "holderOrganization" },
  { name: "managementType", type: "string", widget: "select", label: F("managementType"), enum: MANAGEMENT_TYPES, required: true, placeholder: F("selectPlaceholder"), group: "manageModel" },
  { name: "managementTypeOther", type: "string", widget: "text", label: F("managementTypeOther"), visibleIf: VIS_MGMT_AUTRE, group: "manageModel" },
  { name: "family", type: "array", widget: "checkboxGroup", label: F("family"), enum: FAMILY_OPTIONS, widgetProps: { variant: "card" }, group: "typePlace" },
  { name: "surfaceBuilt", type: "number", widget: "number", label: F("surfaceBuilt"), placeholder: F("surfacePlaceholder"), read: "coerce:string", write: "tl:numOrUndef", path: "buildingSurfaceArea" },
  { name: "surfaceOutdoor", type: "number", widget: "number", label: F("surfaceOutdoor"), placeholder: F("surfacePlaceholder"), read: "coerce:string", write: "tl:numOrUndef", path: "siteSurfaceArea" },

  // `widgetProps.required` = marqueur visuel `*` (obligation) SANS contrainte zodGen (l'objet `address`
  // n'est jamais peuplé : la cascade écrit des champs à plat) — l'obligation réelle est portée par addressComplete.
  // renderOnly : ancre du widget location qui pilote les champs PLATS d'adresse (group "address") — ni seedée ni émise.
  { name: "address", type: "object", widget: "location", label: F("address"), widgetProps: { required: true }, renderOnly: true },
  // Inputs PLAIN (sans icône) typés email/tel — parité visuelle avec l'original.
  { name: "email", type: "string", widget: "text", label: F("email"), required: true, placeholder: F("emailPlaceholder"),
    widgetProps: { inputType: "email" }, rules: { regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" }, read: "coerce:pickString" },
  { name: "phone", type: "string", widget: "text", label: F("phone"), placeholder: F("phonePlaceholder"), widgetProps: { inputType: "tel" }, read: "coerce:pickString", write: "coerce:orUndef", path: "telephone" },

  // renderOnly : image traitée hors element/save (bloc PROFIL_IMAGE via le hook) — ni seedée ni émise au payload data.
  { name: "_logoFile", type: "object", widget: "image", label: F("logo"), info: F("logoHint"), widgetProps: { shape: "square", aspect: 1 }, renderOnly: true },
  // label "" : le titre du sous-bloc « Vidéo » est porté par le GROUPE (cf. section media).
  { name: "videoUrl", type: "string", widget: "text", label: "", placeholder: F("videoUrlPlaceholder"), read: "tl:video0", write: "tl:videoWrite", path: "video" },

  { name: "websiteUrl", type: "string", widget: "text", label: F("websiteUrl"), placeholder: F("websiteUrlPlaceholder"), read: "coerce:pickString", write: "coerce:orUndef", path: "url" },
  // socialLinks = array (form) ↔ objet `socialNetwork` (serveur) ; clear "" (jamais [] — sémantique objet, byte-fidèle).
  { name: "socialLinks", type: "array", widget: "fieldArray", label: F("socialNetworks"), read: "tl:socialRead", write: "tl:socialWrite", path: "socialNetwork", clear: "",
    widgetProps: {
      addLabel: F("addSocial"),
      itemFields: [
        { name: "platform", kind: "select", label: F("socialPlatform"), options: SOCIAL_PLATFORMS },
        { name: "url", kind: "text", placeholder: F("socialUrlPlaceholder") },
      ],
    } },

  { name: "hours", type: "object", widget: "openingHours", label: F("openingHours"), widgetProps: { dayLabelPrefix: "AddTiersLieux.days" }, read: "tl:hoursRead", write: "tl:hoursWrite", path: "openingHours" },
  { name: "description", type: "string", widget: "textarea", label: F("longDescription"), placeholder: F("longDescriptionPlaceholder"), widgetProps: { rows: 10 }, read: "coerce:pickString", write: "coerce:orUndef" },

  // ── Champs PIPELINE-only (hidden, hors sections → non rendus) ──────────────────────────────────────
  { name: "familyOther", type: "string", widget: "hidden", label: "familyOther", group: "typePlace" },
  // Adresse à plat (membres du groupe "address") — peuplés par le widget location, recomposés en objet au write.
  { name: "addressCountry", type: "string", widget: "hidden", label: "addressCountry", group: "address" },
  { name: "addressLocality", type: "string", widget: "hidden", label: "addressLocality", group: "address" },
  { name: "postalCode", type: "string", widget: "hidden", label: "postalCode", group: "address" },
  { name: "streetAddress", type: "string", widget: "hidden", label: "streetAddress", group: "address" },
  { name: "localityId", type: "string", widget: "hidden", label: "localityId", group: "address" },
  // Coordonnées : writeOnly (posées par EditLocationTab AVEC l'adresse, jamais relues), émises liées à localityId.
  { name: "geo", type: "object", widget: "hidden", label: "geo", writeOnly: true, write: "geo:write" },
  { name: "geoPosition", type: "object", widget: "hidden", label: "geoPosition", writeOnly: true, write: "geoPosition:write" },
];

export const tiersLieuxDescriptor: FormDescriptor = {
  id: "tiers-lieux",
  icon: "building-2", // badge de titre (parité ancien form)
  collection: "organizations",
  costumSlug: "navigatorDesTierslieux",
  // wizard : « Suivant » VALIDE l'étape (cf. goNext/form.trigger de TiersLieuxForm), Précédent/Suivant.
  // Variant de présentation = look de l'ANCIEN form : stepper onglets icône+label, barre de progression,
  // header dégradé (le défaut « équipement » serait pills/count/plain). Tout est sérialisable (config).
  layout: { kind: "wizard", validatePerStep: true, stepper: "tabs", progress: "bar", header: "gradient" },
  sections: [
    // INFO — ordre original : nom, (date d'ouverture = mois+année), desc. courte, structure,
    // mode de gestion (+autre), famille (cases 2 col.), surfaces (2 col.).
    { id: "info", label: "AddTiersLieux.steps.info", icon: "building-2", groups: [
      { columns: 1, fields: ["name"] },
      { columns: 2, label: F("openingDate"), fields: ["openingMonth", "openingYear"] },
      { columns: 1, fields: ["shortDescription"] },
      { columns: 1, fields: ["structureName"] },
      { columns: 1, fields: ["managementType", "managementTypeOther"] },
      { columns: 1, fields: ["family"] },
      { columns: 2, fields: ["surfaceBuilt", "surfaceOutdoor"] },
    ] },
    // CONTACT — adresse (label « Adresse * » + message d'erreur portés par le widget location) puis
    // sous-bloc « Contact » bordé : email + téléphone EMPILÉS (1 col.). L'erreur addressComplete est portée
    // sur `address` (dans la section → allume le badge d'onglet + bloque « Suivant »).
    { id: "contact", label: "AddTiersLieux.steps.contact", icon: "map-pin", groups: [
      { columns: 1, fields: ["address"] },
      { columns: 1, divider: true, label: "Contact", titleClassName: "text-sm font-semibold", fields: ["email", "phone"] },
    ] },
    // MEDIA — logo, puis vidéo en sous-bloc bordé titré (text-base font-semibold, parité original).
    { id: "media", label: "AddTiersLieux.steps.media", icon: "image", groups: [
      { columns: 1, fields: ["_logoFile"] },
      { columns: 1, divider: true, label: F("videoUrl"), titleClassName: "text-base font-semibold", fields: ["videoUrl"] },
    ] },
    // ONLINE — site web, puis réseaux sociaux en sous-bloc bordé (titre porté par le champ fieldArray).
    { id: "online", label: "AddTiersLieux.steps.online", icon: "globe", groups: [
      { columns: 1, fields: ["websiteUrl"] },
      { columns: 1, divider: true, fields: ["socialLinks"] },
    ] },
    // DETAILS — horaires (titre porté par le widget), puis description longue en sous-bloc bordé.
    { id: "details", label: "AddTiersLieux.steps.details", icon: "file-text", groups: [
      { columns: 1, fields: ["hours"] },
      { columns: 1, divider: true, fields: ["description"] },
    ] },
  ],
  fields: Object.fromEntries(fields.map((f) => [f.name, f])),
  // Groupes de sérialisation (N champs plats ↔ 1 clé/objet serveur) — transforms tl:* enregistrés par
  // utils/tiersLieuxMapping (importé en side-effect). Ex-TIERSLIEU_DESCRIPTOR, désormais porté ici (unifié).
  serializeGroups: {
    openingDate: { serverKey: "openingDate", read: "tl:openingDateRead", write: "tl:openingDateWrite" },
    manageModel: { serverKey: "manageModel", read: "tl:manageModelRead", write: "tl:manageModelWrite" },
    typePlace: { serverKey: "typePlace", read: "tl:typePlaceRead", write: "tl:typePlaceWrite" },
    address: { serverKey: "address", read: "address:read", write: "tl:addressWrite" },
  },
  // addressComplete (cross-champ) : adresse COMPLÈTE obligatoire pour un tiers-lieu — ville (localityId)
  // + code postal + rue. Erreur sur addressLocality (allume le badge de l'étape contact + bloque « Suivant »).
  // Par CLÉ de registre → sérialisable (round-trip config exact).
  validate: "addressComplete",
};
