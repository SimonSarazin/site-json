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

/** Libellé bilingue inline (LocalizedString) — résolu locale-aware au rendu par useT (cf. EntityFormModal). */
const L = (fr: string, en: string) => ({ fr, en });

// ⚠️ EN AUTORÉ (ces enums étaient en français littéral, sans valeur EN dans l'i18n) — fr inchangé, en à valider.
const MANAGEMENT_TYPES = [
  { value: "association", label: L("Association", "Association") },
  { value: "collectif-citoyen", label: L("Collectif citoyen", "Citizen collective") },
  { value: "universites", label: L("Universités / Écoles", "Universities / Schools") },
  { value: "etablissements-scolaires", label: L("Établissements scolaires", "Schools") },
  { value: "collectivites", label: L("Collectivités", "Local authorities") },
  { value: "sarl-sa-sas", label: L("SARL / SA / SAS", "SARL / SA / SAS") },
  { value: "scic", label: L("SCIC", "SCIC") },
  { value: "scop", label: L("SCOP", "SCOP") },
  { value: "autre", label: L("Autre mode de gestion", "Other management type") },
];

// ⚠️ EN AUTORÉ — fr inchangé, en à valider.
const FAMILY_OPTIONS = [
  { value: "ateliers-artisanaux", label: L("Ateliers artisanaux partagés", "Shared craft workshops") },
  { value: "coworking", label: L("Bureaux partagés / Coworking", "Shared offices / Coworking") },
  { value: "foodlab", label: L("Cuisine partagée / Foodlab", "Shared kitchen / Foodlab") },
  { value: "fablab", label: L("Fablab / Makerspace / Hackerspace", "Fablab / Makerspace / Hackerspace") },
  { value: "livinglab", label: L("LivingLab / Innovation sociale", "LivingLab / Social innovation") },
  { value: "nourricier", label: L("Tiers-lieu nourricier", "Food third-place") },
  { value: "culturel", label: L("Tiers-lieu culturel", "Cultural third-place") },
  { value: "autre", label: L("Autre famille de tiers-lieux", "Other third-place family") },
];

// Noms de marque — identiques fr/en, laissés en string brut (rendus tels quels dans les deux langues).
const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook" }, { value: "twitter", label: "Twitter / X" },
  { value: "instagram", label: "Instagram" }, { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" }, { value: "mastodon", label: "Mastodon" },
  { value: "telegram", label: "Telegram" }, { value: "discord", label: "Discord" },
];

// ⚠️ EN AUTORÉ (mois anglais) — fr inchangé.
const MONTHS = ([["Janvier", "January"], ["Février", "February"], ["Mars", "March"], ["Avril", "April"], ["Mai", "May"], ["Juin", "June"], ["Juillet", "July"], ["Août", "August"], ["Septembre", "September"], ["Octobre", "October"], ["Novembre", "November"], ["Décembre", "December"]] as const)
  .map(([fr, en], i) => ({ value: String(i + 1).padStart(2, "0"), label: L(fr, en) }));
// Années (courante+5 → 1900) : options DYNAMIQUES via `enumFrom:"tl:years"` (registre, enregistré dans ./fns) —
// PAS un `enum` figé (qui se périmerait dans une config JSON statique). cf. mécanisme enumFrom.

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
  // Codecs de groupe PARAMÉTRÉS (génériques + params en données) — plus de tl:openingDate*/manageModel*/typePlace*.
  serializeGroups: {
    openingDate: { serverKey: "openingDate", read: "monthYear:read", write: "monthYear:write", params: { monthField: "openingMonth", yearField: "openingYear", day: "01" } },
    manageModel: { serverKey: "manageModel", read: "enumOrOther:read", write: "enumOrOther:write", params: { valueField: "managementType", otherField: "managementTypeOther", known: MANAGEMENT_TYPES.map((o) => o.value), other: "autre" } },
    typePlace: { serverKey: "typePlace", read: "multiCsv:read", write: "multiCsv:write", params: { arrayField: "family", otherField: "familyOther", other: "autre", separator: ", ", readOtherFrom: "typePlaceOther" } },
    address: { serverKey: "address", read: "address:read", write: "address:write" },
  },

  // ── CHAMPS : widget + overrides (read/write/path/enum hétérogènes). Membres de groupe = pas de read/write dérivé. ──
  fields: {
    name: { widget: "text", label: L("Nom du tiers-lieu", "Name of the third-place"), required: true, placeholder: L("Nom du tiers-lieu", "Name of the third-place"), read: "coerce:pickString" },
    // Mois/année : pas de label propre (sous le titre de GROUPE « Date d'ouverture »).
    openingMonth: { widget: "select", label: "", enum: MONTHS, placeholder: L("Mois", "Month"), group: "openingDate" },
    openingYear: { widget: "select", label: "", enumFrom: "tl:years", placeholder: L("Année", "Year"), group: "openingDate" },
    shortDescription: { widget: "textarea", label: L("Description courte", "Short description"), required: true, widgetProps: { rows: 2 }, read: "coerce:pickString", write: "coerce:orUndef" },
    structureName: { widget: "text", label: L("Nom de la structure porteuse (si différent)", "Operating organization (if different)"), read: "coerce:pickString", write: "coerce:orUndef", path: "holderOrganization" },
    managementType: { widget: "select", label: L("Mode de gestion", "Management type"), enum: MANAGEMENT_TYPES, required: true, placeholder: L("Sélectionner...", "Select..."), group: "manageModel" },
    managementTypeOther: { widget: "text", label: L("Si autre mode de gestion, précisez", "If other management type, please specify"), visibleIf: VIS_MGMT_AUTRE, group: "manageModel" },
    family: { widget: "checkboxGroup", label: L("Famille(s) de tiers-lieux", "Third-place family/families"), enum: FAMILY_OPTIONS, widgetProps: { variant: "card" }, group: "typePlace" },
    surfaceBuilt: { widget: "number", label: L("Surface bâtie (m²)", "Built surface (m²)"), placeholder: L("En m²", "In m²"), read: "coerce:string", write: "tl:numOrUndef", path: "buildingSurfaceArea" },
    surfaceOutdoor: { widget: "number", label: L("Surface extérieure (m²)", "Outdoor surface (m²)"), placeholder: L("En m²", "In m²"), read: "coerce:string", write: "tl:numOrUndef", path: "siteSurfaceArea" },

    // ancre composite location (pilote les champs plats d'adresse) — renderOnly via le widget.
    address: { widget: "location", label: L("Adresse", "Address"), widgetProps: { required: true } },
    email: { widget: "text", label: L("Email", "Email"), required: true, placeholder: L("contact@exemple.org", "contact@example.org"), widgetProps: { inputType: "email" }, rules: { regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" }, read: "coerce:pickString" },
    phone: { widget: "text", label: L("Téléphone", "Phone"), placeholder: L("+33 ...", "+1 ..."), widgetProps: { inputType: "tel" }, read: "coerce:pickString", write: "coerce:orUndef", path: "telephone" },

    // image traitée hors element/save — renderOnly via le widget.
    _logoFile: { widget: "image", label: L("Logo du tiers-lieu", "Third-place logo"), info: L("Format carré recommandé · PNG ou JPG", "Square format recommended · PNG or JPG"), widgetProps: { shape: "square", aspect: 1 } },
    videoUrl: { widget: "text", label: "", placeholder: L("https://youtube.com/...", "https://youtube.com/..."), read: "tl:video0", write: "tl:videoWrite", path: "video" },
    websiteUrl: { widget: "text", label: L("Site internet", "Website"), placeholder: L("http://www.exemple.org", "http://www.example.org"), read: "coerce:pickString", write: "coerce:orUndef", path: "url" },
    socialLinks: {
      widget: "fieldArray", label: L("Réseaux sociaux", "Social networks"), read: "social:read", write: "social:write", path: "socialNetwork", clear: "",
      widgetProps: {
        addLabel: L("Ajouter un réseau social", "Add a social network"),
        itemFields: [
          { name: "platform", kind: "select", label: L("Plateforme", "Platform"), options: SOCIAL_PLATFORMS },
          { name: "url", kind: "text", placeholder: L("https://...", "https://...") },
        ],
      },
    },
    // read/write hérités du WIDGET `openingHours` (codec commun openingHours:read/write, cf. WIDGET_DEFAULTS).
    hours: { widget: "openingHours", label: L("Horaires d'ouverture", "Opening hours"), widgetProps: { dayLabelPrefix: "AddTiersLieux.days" }, path: "openingHours" },
    description: { widget: "textarea", label: L("Description longue", "Long description"), placeholder: L("Décrivez votre tiers-lieu...", "Describe your third-place..."), widgetProps: { rows: 10 }, read: "coerce:pickString", write: "coerce:orUndef" },

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
    { id: "info", label: L("Infos", "Info"), icon: "building-2", groups: [
      { columns: 1, fields: ["name"] },
      { columns: 2, label: L("Date d'ouverture du tiers-lieu", "Opening date"), fields: ["openingMonth", "openingYear"] },
      { columns: 1, fields: ["shortDescription"] },
      { columns: 1, fields: ["structureName"] },
      { columns: 1, fields: ["managementType", "managementTypeOther"] },
      { columns: 1, fields: ["family"] },
      { columns: 2, fields: ["surfaceBuilt", "surfaceOutdoor"] },
    ] },
    { id: "contact", label: L("Contact", "Contact"), icon: "map-pin", groups: [
      { columns: 1, fields: ["address"] },
      { columns: 1, divider: true, label: L("Contact", "Contact"), titleClassName: "text-sm font-semibold", fields: ["email", "phone"] },
    ] },
    { id: "media", label: L("Médias", "Media"), icon: "image", groups: [
      { columns: 1, fields: ["_logoFile"] },
      { columns: 1, divider: true, label: L("Lien vers vidéo de présentation", "Presentation video URL"), titleClassName: "text-base font-semibold", fields: ["videoUrl"] },
    ] },
    { id: "online", label: L("En ligne", "Online"), icon: "globe", groups: [
      { columns: 1, fields: ["websiteUrl"] },
      { columns: 1, divider: true, fields: ["socialLinks"] },
    ] },
    { id: "details", label: L("Détails", "Details"), icon: "file-text", groups: [
      { columns: 1, fields: ["hours"] },
      { columns: 1, divider: true, fields: ["description"] },
    ] },
  ],

  // ── MODAL ──
  chrome: {
    title: { add: L("Créer votre tiers-lieu", "Create your third-place"), edit: L("Modifier votre tiers-lieu", "Edit your third-place") },
    submitLabel: { add: L("Créer le tiers-lieu", "Create the third-place"), edit: L("Enregistrer les modifications", "Save changes") },
    gradientHeader: true,
    dialogClassName: "sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden",
    validationFailedKey: L("Veuillez corriger les champs en erreur (voir les onglets signalés).", "Please fix the highlighted fields (see the flagged tabs)."),
    navText: {
      next: L("Suivant →", "Next →"),
      previous: L("← Précédent", "← Previous"),
      cancel: L("Annuler", "Cancel"),
      stepTemplate: { stepKey: L("Étape", "Step"), ofKey: L("sur", "of") },
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
    invalidateFn: { fn: "invalidate:standard", params: { userList: "organizations" } },
  },
};
