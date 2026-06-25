/**
 * Contrat zod `JsonFormConfig` — surcouche SÉRIALISABLE de FormDescriptor, source d'un formulaire
 * config-driven (cf. doc/formulaire-config-driven.md). Fichier FEUILLE : ne dépend que de
 * `locale-schema` (évite les cycles), pas du moteur. Principe : AUCUNE fonction dans la config —
 * les parties non sérialisables (validate / computed / read / write / payload) sont des CLÉS de registre.
 */
import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

// Libellé : objet localisé {fr,en,…} (mode 'localized') OU clé i18n string (mode 'keys').
const Label = z.union([LocalizedString, z.string()]);

// Widgets supportés — aligné sur formEngine `WidgetKind` (gardé en phase manuellement).
const WidgetKind = z.enum([
  "hidden", "text", "email", "tel", "textarea", "number",
  "switch", "checkbox", "checkboxGroup",
  "select", "multiselect", "selectFromLists",
  "tags", "date", "datetime", "time",
  "urlList", "image", "location", "openingHours",
  "finder", "eventDates", "fieldArray", "custom",
  "editSocial", "editSchedule",
]);

const FieldType = z.enum(["string", "number", "boolean", "date", "array", "object"]);

// ── Predicate (conditionnel) — aligné sur formEngine `Predicate`, récursif ───────
const PredicateOp = z.enum([
  "eq", "ne", "in", "nin", "gt", "gte", "lt", "lte",
  "truthy", "falsy", "empty", "notEmpty", "matches", "contains",
]);
export const PredicateJson: z.ZodType = z.lazy(() =>
  z.union([
    z.object({ field: z.string(), op: PredicateOp, value: z.unknown().optional() }),
    z.object({ and: z.array(PredicateJson) }),
    z.object({ or: z.array(PredicateJson) }),
    z.object({ not: PredicateJson }),
  ]),
);

const Rules = z.object({
  url: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  regex: z.string().optional(),
});

const EnumOption = z.object({ value: z.string(), label: Label });

const FieldConfig = z.object({
  type: FieldType,
  widget: WidgetKind,
  label: Label,
  placeholder: Label.optional(),
  placeholderSearch: Label.optional(), // zone de recherche select/multiselect
  info: Label.optional(),
  path: z.string().optional(),
  default: z.unknown().optional(),
  multiple: z.boolean().optional(),
  optionsKey: z.string().optional(),
  enum: z.array(EnumOption).optional(),
  enumFrom: z.string().optional(), // clé d'options dynamiques (registerOptions) — résolues au rendu

  required: z.boolean().optional(),
  requiredIf: PredicateJson.optional(),
  visibleIf: PredicateJson.optional(),
  rules: Rules.optional(),
  // Messages d'erreur PAR règle, en LocalizedString (comme le reste du schéma) — config auto-suffisante.
  messages: z.object({
    required: Label.optional(),
    url: Label.optional(),
    min: Label.optional(),
    max: Label.optional(),
    minLength: Label.optional(),
    maxLength: Label.optional(),
    format: Label.optional(),
  }).optional(),
  computedFrom: z.object({ deps: z.array(z.string()), fn: z.string() }).optional(),
  read: z.string().optional(),   // clé registre transform
  write: z.string().optional(),  // clé registre transform
  widgetProps: z.record(z.string(), z.unknown()).optional(),
  // ── Pipeline READ/WRITE (parité descripteur ; aligné sur FieldDescriptor) ──────
  // Membre d'un groupe de SÉRIALISATION (cf. `serializeGroups`) : N champs plats ↔ 1 objet serveur.
  group: z.string().optional(),
  // Groupe ATOMIQUE : si un membre change, tout le groupe est ré-émis ENSEMBLE au diff d'édition.
  atomicGroup: z.string().optional(),
  // WRITE-only : ignoré au READ (seed), émis au payload (ex. geo/geoPosition posés par EditLocationTab).
  writeOnly: z.boolean().optional(),
  // READ-only : seedé mais jamais émis au payload (ex. `public`/`urls`).
  readOnly: z.boolean().optional(),
  // RENDER-only : ancrage UI sans mapping serveur (widget composite : location/image) → ni seedé ni émis.
  renderOnly: z.boolean().optional(),
  // Valeur d'EFFACEMENT (diff d'édition) ; défaut dérivé du type. JAMAIS `{}`.
  clear: z.unknown().optional(),
});

// Groupe de sérialisation : N champs plats (membres via `field.group`) ↔ 1 clé/objet serveur.
// `read`/`write` = clés de registre transform (objet serveur ↔ valeurs plates). cf. FormDescriptor.serializeGroups.
const SerializeGroup = z.object({
  serverKey: z.string(),
  read: z.string(),
  write: z.string(),
  groupReadOnly: z.boolean().optional(),
  // DONNÉES passées aux codecs de groupe PARAMÉTRÉS (monthYear/enumOrOther/multiCsv…) — cf. applyTransform 3e arg.
  params: z.record(z.string(), z.unknown()).optional(),
});

const Group = z.object({
  columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  label: Label.optional(),
  required: z.boolean().optional(),
  visibleIf: PredicateJson.optional(),
  divider: z.boolean().optional(),
  titleClassName: z.string().optional(),
  fields: z.array(z.string()),
});

const Section = z.object({
  id: z.string(),
  label: Label.optional(),
  icon: z.string().optional(), // nom lucide → icône d'étape/onglet (stepper)
  visibleIf: PredicateJson.optional(),
  groups: z.array(Group).optional(),
  fields: z.array(z.string()).optional(),
});

const Submit = z.object({
  mode: z.enum(["sdk", "fetch"]).default("sdk"),
  action: z.string().optional(),
  method: z.enum(["GET", "POST"]).optional(),
  presets: z.record(z.string(), z.unknown()).optional(),
  tagsFrom: z.array(z.string()).optional(),
  extraData: z.record(z.string(), z.unknown()).optional(),
  payloadFn: z.string().optional(),  // clé registre de mapping values→payload
  successMessage: Label.optional(),
  errorMessage: Label.optional(),
});

export const JsonFormConfigSchema = z.object({
  id: z.string(),
  title: Label.optional(),
  icon: z.string().optional(), // icône de titre du formulaire (badge, nom lucide)
  entityType: z.enum(["organization", "project", "event", "poi", "citoyen"]),
  collection: z.enum(["poi", "organizations", "projects", "events", "citoyens"]).optional(),
  costum: z.object({ slug: z.string() }).optional(),
  layout: z.object({
    kind: z.enum(["flat", "tabs", "wizard", "accordion"]),
    validatePerStep: z.boolean().optional(),
    // Variants de présentation (défaut « équipement » : pills/count/plain).
    stepper: z.enum(["pills", "tabs"]).optional(),
    progress: z.enum(["count", "bar", "none"]).optional(),
    header: z.enum(["plain", "gradient"]).optional(),
  }),
  i18n: z.enum(["localized", "keys"]).optional(),
  sections: z.array(Section),
  fields: z.record(z.string(), FieldConfig),
  // Groupes de sérialisation (adresse→PostalAddress, social→socialNetwork…), keyés par id de groupe.
  serializeGroups: z.record(z.string(), SerializeGroup).optional(),
  validateFn: z.string().optional(),  // clé registre de validate cross-champ
  submit: Submit.optional(),
  submitLabel: Label.optional(),
});

export type JsonFormConfig = z.infer<typeof JsonFormConfigSchema>;
export type JsonFormFieldConfig = z.infer<typeof FieldConfig>;
export type JsonFormLabel = z.infer<typeof Label>;
