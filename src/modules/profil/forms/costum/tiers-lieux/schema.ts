/**
 * Document FUSIONNÉ (form + modal) du costum « tiers-lieu » (navigatorDesTierslieux, collection organizations).
 * SOURCE UNIQUE : chaque nom de champ apparaît 2× — sa DÉCLARATION (`fields`, widget-driven) et son PLACEMENT
 * (`sections`). type/read/default dérivés du widget par `compileCostumSchema` ; le code irréductible (transforms
 * `tl:*`/`geo:*`/`address:read`, scope, payload, invalidate, validate `addressComplete`) est référencé PAR CLÉ
 * et enregistré dans `./fns` (+ `../../validators`). Posable tel quel dans la config globale JSON.
 *
 * Spécificités tiers-lieu (vs poi) gérées par DONNÉES : `deriveDefaults:false` (socle via `tl:emptyDefaults`,
 * aucun field.default) ; champs HÉTÉROGÈNES (read `coerce:pickString`/`tl:*`, `path`, `write` `coerce:orUndef`)
 * en overrides explicites ; membres de groupes `openingDate`/`manageModel`/`typePlace`/`address` (lus/écrits par
 * le groupe). Byte-parité figée par `compiled.byteparity.test` + `tiersLieu.configDriven` + `tiersLieuxMapping`.
 */
import type { CostumFormSchema } from "../compileCostumSchema";

const F = (k: string) => `AddTiersLieux.fields.${k}`;
/** Libellé bilingue inline (LocalizedString) — résolu locale-aware au rendu par useT (cf. EntityFormModal). */
const L = (fr: string, en: string) => ({ fr, en });

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

export const TIERS_LIEUX_SCHEMA: CostumFormSchema = {
  id: "tiers-lieux",
  entityType: "organizations",
  collection: "organizations",
  costumSlug: "navigatorDesTierslieux",
  icon: "building-2", // badge de titre (parité ancien form) → descriptor.icon + icône de modale
  // Pas de field.default : le socle vient de `tl:emptyDefaults` (defaultsBase).
  deriveDefaults: false,
  // wizard look « ancien form » : stepper onglets, barre de progression, header dégradé (sérialisable).
  layout: { kind: "wizard", validatePerStep: true, stepper: "tabs", progress: "bar", header: "gradient" },
  validateFn: "addressComplete",
  serializeGroups: {
    openingDate: { serverKey: "openingDate", read: "tl:openingDateRead", write: "tl:openingDateWrite" },
    manageModel: { serverKey: "manageModel", read: "tl:manageModelRead", write: "tl:manageModelWrite" },
    typePlace: { serverKey: "typePlace", read: "tl:typePlaceRead", write: "tl:typePlaceWrite" },
    address: { serverKey: "address", read: "address:read", write: "tl:addressWrite" },
  },

  // ── CHAMPS : widget + overrides (read/write/path/enum hétérogènes). Membres de groupe = pas de read/write dérivé. ──
  fields: {
    name: { widget: "text", label: L("Nom du tiers-lieu", "Name of the third-place"), required: true, placeholder: F("namePlaceholder"), read: "coerce:pickString" },
    // Mois/année : pas de label propre (sous le titre de GROUPE « Date d'ouverture »).
    openingMonth: { widget: "select", label: "", enum: MONTHS, placeholder: F("month"), group: "openingDate" },
    openingYear: { widget: "select", label: "", enum: YEARS, placeholder: F("year"), group: "openingDate" },
    shortDescription: { widget: "textarea", label: L("Description courte", "Short description"), required: true, widgetProps: { rows: 2 }, read: "coerce:pickString", write: "coerce:orUndef" },
    structureName: { widget: "text", label: L("Nom de la structure porteuse (si différent)", "Operating organization (if different)"), read: "coerce:pickString", write: "coerce:orUndef", path: "holderOrganization" },
    managementType: { widget: "select", label: L("Mode de gestion", "Management type"), enum: MANAGEMENT_TYPES, required: true, placeholder: F("selectPlaceholder"), group: "manageModel" },
    managementTypeOther: { widget: "text", label: L("Si autre mode de gestion, précisez", "If other management type, please specify"), visibleIf: VIS_MGMT_AUTRE, group: "manageModel" },
    family: { widget: "checkboxGroup", label: L("Famille(s) de tiers-lieux", "Third-place family/families"), enum: FAMILY_OPTIONS, widgetProps: { variant: "card" }, group: "typePlace" },
    surfaceBuilt: { widget: "number", label: L("Surface bâtie (m²)", "Built surface (m²)"), placeholder: F("surfacePlaceholder"), read: "coerce:string", write: "tl:numOrUndef", path: "buildingSurfaceArea" },
    surfaceOutdoor: { widget: "number", label: L("Surface extérieure (m²)", "Outdoor surface (m²)"), placeholder: F("surfacePlaceholder"), read: "coerce:string", write: "tl:numOrUndef", path: "siteSurfaceArea" },

    // ancre composite location (pilote les champs plats d'adresse) — renderOnly via le widget.
    address: { widget: "location", label: L("Adresse", "Address"), widgetProps: { required: true } },
    email: { widget: "text", label: L("Email", "Email"), required: true, placeholder: F("emailPlaceholder"), widgetProps: { inputType: "email" }, rules: { regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" }, read: "coerce:pickString" },
    phone: { widget: "text", label: L("Téléphone", "Phone"), placeholder: F("phonePlaceholder"), widgetProps: { inputType: "tel" }, read: "coerce:pickString", write: "coerce:orUndef", path: "telephone" },

    // image traitée hors element/save — renderOnly via le widget.
    _logoFile: { widget: "image", label: L("Logo du tiers-lieu", "Third-place logo"), info: L("Format carré recommandé · PNG ou JPG", "Square format recommended · PNG or JPG"), widgetProps: { shape: "square", aspect: 1 } },
    videoUrl: { widget: "text", label: "", placeholder: F("videoUrlPlaceholder"), read: "tl:video0", write: "tl:videoWrite", path: "video" },
    websiteUrl: { widget: "text", label: L("Site internet", "Website"), placeholder: F("websiteUrlPlaceholder"), read: "coerce:pickString", write: "coerce:orUndef", path: "url" },
    socialLinks: {
      widget: "fieldArray", label: L("Réseaux sociaux", "Social networks"), read: "tl:socialRead", write: "tl:socialWrite", path: "socialNetwork", clear: "",
      widgetProps: {
        addLabel: F("addSocial"),
        itemFields: [
          { name: "platform", kind: "select", label: F("socialPlatform"), options: SOCIAL_PLATFORMS },
          { name: "url", kind: "text", placeholder: F("socialUrlPlaceholder") },
        ],
      },
    },
    hours: { widget: "openingHours", label: L("Horaires d'ouverture", "Opening hours"), widgetProps: { dayLabelPrefix: "AddTiersLieux.days" }, read: "tl:hoursRead", write: "tl:hoursWrite", path: "openingHours" },
    description: { widget: "textarea", label: L("Description longue", "Long description"), placeholder: F("longDescriptionPlaceholder"), widgetProps: { rows: 10 }, read: "coerce:pickString", write: "coerce:orUndef" },

    // ── pipeline-only (hidden, hors sections) ; membres de groupe (label ⇐ nom) ──
    familyOther: { widget: "hidden", group: "typePlace" },
    addressCountry: { widget: "hidden", group: "address" },
    addressLocality: { widget: "hidden", group: "address" },
    postalCode: { widget: "hidden", group: "address" },
    streetAddress: { widget: "hidden", group: "address" },
    localityId: { widget: "hidden", group: "address" },
    geo: { widget: "hidden", type: "object", writeOnly: true, write: "geo:write" },
    geoPosition: { widget: "hidden", type: "object", writeOnly: true, write: "geoPosition:write" },
  },

  // ── PLACEMENT (wizard 5 étapes, parité TiersLieuxForm) ──
  sections: [
    { id: "info", label: "AddTiersLieux.steps.info", icon: "building-2", groups: [
      { columns: 1, fields: ["name"] },
      { columns: 2, label: F("openingDate"), fields: ["openingMonth", "openingYear"] },
      { columns: 1, fields: ["shortDescription"] },
      { columns: 1, fields: ["structureName"] },
      { columns: 1, fields: ["managementType", "managementTypeOther"] },
      { columns: 1, fields: ["family"] },
      { columns: 2, fields: ["surfaceBuilt", "surfaceOutdoor"] },
    ] },
    { id: "contact", label: "AddTiersLieux.steps.contact", icon: "map-pin", groups: [
      { columns: 1, fields: ["address"] },
      { columns: 1, divider: true, label: "Contact", titleClassName: "text-sm font-semibold", fields: ["email", "phone"] },
    ] },
    { id: "media", label: "AddTiersLieux.steps.media", icon: "image", groups: [
      { columns: 1, fields: ["_logoFile"] },
      { columns: 1, divider: true, label: F("videoUrl"), titleClassName: "text-base font-semibold", fields: ["videoUrl"] },
    ] },
    { id: "online", label: "AddTiersLieux.steps.online", icon: "globe", groups: [
      { columns: 1, fields: ["websiteUrl"] },
      { columns: 1, divider: true, fields: ["socialLinks"] },
    ] },
    { id: "details", label: "AddTiersLieux.steps.details", icon: "file-text", groups: [
      { columns: 1, fields: ["hours"] },
      { columns: 1, divider: true, fields: ["description"] },
    ] },
  ],

  // ── MODAL ──
  chrome: {
    title: { add: "AddTiersLieux.title", edit: "EditTiersLieux.title" },
    submitLabel: { add: "AddTiersLieux.buttons.submit", edit: "EditTiersLieux.buttons.submit" },
    gradientHeader: true,
    dialogClassName: "sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden",
    validationFailedKey: "AddTiersLieux.errors.validationFailed",
    navText: {
      next: "AddTiersLieux.buttons.next",
      previous: "AddTiersLieux.buttons.previous",
      cancel: "AddTiersLieux.buttons.cancel",
      stepTemplate: { stepKey: "AddTiersLieux.step", ofKey: "AddTiersLieux.stepOf" },
    },
  },
  image: { field: "_logoFile", existingUrlFrom: "image:profilUrl" },
  scope: { derive: "tl:scope", slugFrom: "derived", slugKey: "slug" },
  defaultsBase: "tl:emptyDefaults",
  mutation: {
    entityType: "organizations",
    payloadFn: "tl:payload",
    payloadEmitEmptyOnEdit: true, // (informatif : tl:payload gère lui-même complete:true en édition)
    // STAMP costum (valeurs fixes au CREATE) : un tiers-lieu est une organisation NGO open-data.
    inject: { extraFields: { type: "NGO", preferences: { isOpenData: true, isOpenEdition: true } } },
    successKey: { add: "AddTiersLieux.toast.success", edit: "EditTiersLieux.toast.success" },
    errorKey: { add: "AddTiersLieux.toast.error", edit: "EditTiersLieux.toast.error" },
    errorContext: { add: "EntityFormModal · ADD_TIERSLIEU", edit: "EntityFormModal · EDIT_TIERSLIEU" },
    invalidateFn: "tl:invalidate",
  },
};
