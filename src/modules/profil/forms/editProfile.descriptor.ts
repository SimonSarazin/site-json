/**
 * Descripteurs d'édition de profil — UN PAR ENTITÉ (plats, champs déclarés comme les add/*, zéro
 * conditionnel entityType). On ne réutilise les composites que pour les blocs vraiment composites :
 * adresse (location), réseaux sociaux (editSocial), horaires (editSchedule), dates event (eventDates).
 * La VALIDATION des champs vient du schéma existant `getProfileSchema(entityType)` (branché via le
 * `schema` de GenericForm) → byte-compat, pas de re-dérivation. Migration incrémentale : citoyens d'abord.
 */
import { EVENT_TYPES, ORGANIZATION_TYPES } from "@communecter/cocolight-api-client";
import type { FieldDescriptor, FormDescriptor } from "@/modules/formEngine";
import "./validators"; // side-effect : enregistre la clé "editEventValid" dans le validateRegistry

const PE = (k: string) => `ProfileEdit.fields.${k}`;
const TAB = (k: string) => `ProfileEdit.tabs.${k}`;
const NOW_Y = new Date().getFullYear();

const text = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor =>
  ({ name, type: "string", widget: "text", label: PE(`${name}.label`), placeholder: PE(`${name}.placeholder`), info: PE(`${name}.description`), ...extra });

// ── CITOYENS ──────────────────────────────────────────────────────────────────
const citoyenFields: FieldDescriptor[] = [
  text("name", { required: true }),
  text("slug", { required: true }),
  { name: "birthDate", type: "date", widget: "date", label: PE("birthDate.label"), placeholder: PE("birthDate.placeholder"), info: PE("birthDate.description"),
    widgetProps: { endYear: NOW_Y - 13 } }, // ≥ 13 ans (parité EditBasicInfoTab)
  text("shortDescription", { widget: "textarea", widgetProps: { rows: 2 } }),
  text("description", { widget: "textarea" }),
  { name: "tags", type: "array", widget: "tags", label: PE("tags.label"), widgetProps: { extendedTexts: true } },
  text("email", { widgetProps: { inputType: "email" } }),
  text("mobile", { widgetProps: { inputType: "tel" } }),
  text("fixe", { widgetProps: { inputType: "tel" } }),
  text("url", { widgetProps: { inputType: "url" } }),
  { name: "_location", type: "object", widget: "location", label: "" },
  { name: "_social", type: "object", widget: "editSocial", label: "" },
];

export const editCitoyenDescriptor: FormDescriptor = {
  id: "edit-citoyens",
  collection: "citoyens",
  layout: { kind: "tabs" },
  sections: [
    { id: "basic", label: TAB("basic"), groups: [{ columns: 1, fields: ["name", "slug", "birthDate", "shortDescription", "description", "tags"] }] },
    { id: "contact", label: TAB("contact"), groups: [{ columns: 1, fields: ["email", "mobile", "fixe", "url"] }] },
    { id: "location", label: TAB("location.label"), groups: [{ columns: 1, fields: ["_location"] }] },
    { id: "social", label: TAB("social"), groups: [{ columns: 1, fields: ["_social"] }] },
  ],
  fields: Object.fromEntries(citoyenFields.map((f) => [f.name, f])),
};

// ── ORGANIZATIONS ───────────────────────────────────────────────────────────
// Pas d'onglet social (cf. ENTITY_TABS legacy) : les 9 champs sociaux transitent via les defaults
// (useProfileFormData les lit, buildProfileUpdateData les ré-écrit) → round-trip byte-compat.
const ORG_TYPE_OPTIONS = ORGANIZATION_TYPES.map((tpe) => ({ value: tpe, label: PE(`type.options.${tpe}`) }));

const organizationFields: FieldDescriptor[] = [
  text("name", { required: true }),
  text("slug", { required: true }),
  { name: "type", type: "string", widget: "select", enum: ORG_TYPE_OPTIONS, label: PE("type.label"), placeholder: PE("type.placeholder"), info: PE("type.description") },
  text("shortDescription", { widget: "textarea", widgetProps: { rows: 2 } }),
  text("description", { widget: "textarea" }),
  { name: "tags", type: "array", widget: "tags", label: PE("tags.label"), widgetProps: { extendedTexts: true } },
  text("email", { widgetProps: { inputType: "email" } }),
  text("url", { widgetProps: { inputType: "url" } }),
  { name: "_location", type: "object", widget: "location", label: "" },
  { name: "_schedule", type: "object", widget: "editSchedule", label: "" },
];

export const editOrganizationDescriptor: FormDescriptor = {
  id: "edit-organizations",
  collection: "organizations",
  layout: { kind: "tabs" },
  sections: [
    { id: "basic", label: TAB("basic"), groups: [{ columns: 1, fields: ["name", "slug", "type", "shortDescription", "description", "tags"] }] },
    { id: "contact", label: TAB("contact"), groups: [{ columns: 1, fields: ["email", "url"] }] },
    { id: "location", label: TAB("location.label"), groups: [{ columns: 1, fields: ["_location"] }] },
    { id: "schedule", label: TAB("schedule.label"), groups: [{ columns: 1, fields: ["_schedule"] }] },
  ],
  fields: Object.fromEntries(organizationFields.map((f) => [f.name, f])),
};

// ── PROJECTS ──────────────────────────────────────────────────────────────────
// `parent` = finder multi (organisations + moi). Pas d'onglet social (round-trip via defaults).
// `avancement` (schéma) non rendu dans le legacy → non déclaré (préservé : Object.assign ne le touche pas).
const projectFields: FieldDescriptor[] = [
  text("name", { required: true }),
  text("slug", { required: true }),
  { name: "parent", type: "object", widget: "finder", label: PE("parent.label"), placeholder: PE("parent.placeholder"), info: PE("parent.description"),
    widgetProps: { searchTypes: ["organizations"], multiple: true, includeMe: true } },
  text("shortDescription", { widget: "textarea", widgetProps: { rows: 2 } }),
  text("description", { widget: "textarea" }),
  { name: "tags", type: "array", widget: "tags", label: PE("tags.label"), widgetProps: { extendedTexts: true } },
  text("email", { widgetProps: { inputType: "email" } }),
  text("url", { widgetProps: { inputType: "url" } }),
  { name: "_location", type: "object", widget: "location", label: "" },
];

export const editProjectDescriptor: FormDescriptor = {
  id: "edit-projects",
  collection: "projects",
  layout: { kind: "tabs" },
  sections: [
    { id: "basic", label: TAB("basic"), groups: [{ columns: 1, fields: ["name", "slug", "parent", "shortDescription", "description", "tags"] }] },
    { id: "contact", label: TAB("contact"), groups: [{ columns: 1, fields: ["email", "url"] }] },
    { id: "location", label: TAB("location.label"), groups: [{ columns: 1, fields: ["_location"] }] },
  ],
  fields: Object.fromEntries(projectFields.map((f) => [f.name, f])),
};

// ── EVENTS ────────────────────────────────────────────────────────────────────
// `organizer` finder multi (requis), `parent` finder event (filtre runtime via fieldProps du modal).
// `description` rendue mais NON écrite (le write events l'omet — parité legacy). Onglet dates = composite.
const EVENT_TYPE_OPTIONS = EVENT_TYPES.map((tpe) => ({ value: tpe, label: `ProfileEdit.fields.eventType.options.${tpe}` }));

const eventFields: FieldDescriptor[] = [
  text("name", { required: true }),
  text("slug", { required: true }),
  { name: "type", type: "string", widget: "select", enum: EVENT_TYPE_OPTIONS, label: PE("eventType.label"), placeholder: PE("eventType.placeholder"), info: PE("eventType.description") },
  { name: "organizer", type: "object", widget: "finder", label: PE("organizer.label"), placeholder: PE("organizer.placeholder"), info: PE("organizer.description"),
    widgetProps: { searchTypes: ["organizations", "projects"], multiple: true, includeMe: true } },
  { name: "parent", type: "object", widget: "finder", label: PE("parentEvent.label"), placeholder: PE("parentEvent.placeholder"), info: PE("parentEvent.description"),
    widgetProps: { searchTypes: ["events"] } },
  text("shortDescription", { widget: "textarea", widgetProps: { rows: 2 } }),
  text("description", { widget: "textarea" }),
  { name: "tags", type: "array", widget: "tags", label: PE("tags.label"), widgetProps: { extendedTexts: true } },
  text("email", { widgetProps: { inputType: "email" } }),
  text("url", { widgetProps: { inputType: "url" } }),
  { name: "_location", type: "object", widget: "location", label: "" },
  { name: "_eventDates", type: "object", widget: "eventDates", label: "" },
];

// Validation conditionnelle events : organizer requis + dates (clé "editEventValid" du registre, cf. validators.ts).
export const editEventDescriptor: FormDescriptor = {
  id: "edit-events",
  collection: "events",
  layout: { kind: "tabs" },
  sections: [
    { id: "basic", label: TAB("basic"), groups: [{ columns: 1, fields: ["name", "slug", "type", "organizer", "parent", "shortDescription", "description", "tags"] }] },
    { id: "contact", label: TAB("contact"), groups: [{ columns: 1, fields: ["email", "url"] }] },
    { id: "location", label: TAB("location.label"), groups: [{ columns: 1, fields: ["_location"] }] },
    // startDate/endDate/openingHours (rendus par le composite) listés pour le badge de l'onglet.
    { id: "eventDates", label: TAB("eventDates.label"), groups: [{ columns: 1, fields: ["_eventDates", "startDate", "endDate", "openingHours"] }] },
  ],
  fields: Object.fromEntries(eventFields.map((f) => [f.name, f])),
  validate: "editEventValid",
};

// ── POI ───────────────────────────────────────────────────────────────────────
// Pas de type (non rendu dans le legacy → round-trip), pas de shortDescription, pas de contact/social.
const poiFields: FieldDescriptor[] = [
  text("name", { required: true }),
  text("slug", { required: true }),
  text("description", { widget: "textarea" }),
  { name: "tags", type: "array", widget: "tags", label: PE("tags.label"), widgetProps: { extendedTexts: true } },
  { name: "_location", type: "object", widget: "location", label: "" },
];

export const editPoiDescriptor: FormDescriptor = {
  id: "edit-poi",
  collection: "poi",
  layout: { kind: "tabs" },
  sections: [
    { id: "basic", label: TAB("basic"), groups: [{ columns: 1, fields: ["name", "slug", "description", "tags"] }] },
    { id: "location", label: TAB("location.label"), groups: [{ columns: 1, fields: ["_location"] }] },
  ],
  fields: Object.fromEntries(poiFields.map((f) => [f.name, f])),
};

/** Entités déjà migrées vers le moteur (les autres tombent sur l'ancien EditProfileModal). */
export const EDIT_DESCRIPTORS: Record<string, FormDescriptor> = {
  citoyens: editCitoyenDescriptor,
  organizations: editOrganizationDescriptor,
  projects: editProjectDescriptor,
  events: editEventDescriptor,
  poi: editPoiDescriptor,
};
