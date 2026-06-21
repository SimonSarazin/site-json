/**
 * Adaptateur ANCIEN format (JsonFormModalConfig : steps[].fields[]) → `JsonFormConfig` (nouveau).
 * Permet aux configs PROD existantes (ex. config.prod.cyber-reunion.json) de passer par le moteur
 * SANS réécriture. cf. P2/P3 de doc/formulaire-config-driven.md.
 */
import type { JsonFormConfig, JsonFormFieldConfig } from "@/modules/formEngine";
import type { JsonFormModalConfig } from "@/types/site-schema";

const EMAIL_RE = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";
const TEL_RE = "^[+()0-9.\\-\\s]{6,}$";

/** Détecte une config au NOUVEAU format (présence de `sections`). */
export function isJsonFormConfig(c: unknown): c is JsonFormConfig {
  return !!c && typeof c === "object" && Array.isArray((c as { sections?: unknown }).sections);
}

type LegacyType = NonNullable<JsonFormModalConfig["fields"]>[number]["type"];

/** type legacy → { type, widget } moteur. */
function mapType(t: LegacyType): { type: JsonFormFieldConfig["type"]; widget: JsonFormFieldConfig["widget"]; widgetProps?: Record<string, unknown> } {
  switch (t) {
    case "email": return { type: "string", widget: "text", widgetProps: { inputType: "email" } };
    case "tel": return { type: "string", widget: "text", widgetProps: { inputType: "tel" } };
    case "url": return { type: "string", widget: "text", widgetProps: { inputType: "url" } };
    case "number": return { type: "number", widget: "number" };
    case "textarea": return { type: "string", widget: "textarea" };
    case "select": return { type: "string", widget: "select" };
    case "multiselect": return { type: "array", widget: "multiselect" };
    case "checkbox": return { type: "boolean", widget: "checkbox" };
    case "radio": return { type: "string", widget: "select" }; // radio non modélisé → select
    case "date": return { type: "date", widget: "date" };
    case "location": return { type: "object", widget: "location" };
    case "file": return { type: "object", widget: "image" };
    case "text":
    default: return { type: "string", widget: "text" };
  }
}

/** Règles dérivées du type + de `validation` (email/tel/regex). */
function mapRules(t: LegacyType, validation?: string): JsonFormFieldConfig["rules"] | undefined {
  if (validation === "email" || t === "email") return { regex: EMAIL_RE };
  if (validation === "tel" || t === "tel") return { regex: TEL_RE };
  if (t === "url") return { url: true };
  if (validation) return { regex: validation };
  return undefined;
}

export function legacyToJsonFormConfig(legacy: JsonFormModalConfig): JsonFormConfig {
  const steps = legacy.steps ?? [];
  const flat = legacy.fields ?? [];
  const allFields = steps.length ? steps.flatMap((s) => s.fields) : flat;

  // fields (record)
  const fields: Record<string, JsonFormFieldConfig> = {};
  for (const f of allFields) {
    const { type, widget, widgetProps } = mapType(f.type);
    const rules = mapRules(f.type, f.validation);
    fields[f.name] = {
      type, widget, label: f.label,
      ...(f.placeholder ? { placeholder: f.placeholder } : {}),
      ...(f.required ? { required: true } : {}),
      ...(f.options ? { enum: f.options } : {}),
      ...(widgetProps ? { widgetProps } : {}),
      ...(rules ? { rules } : {}),
    };
  }

  // sections : un onglet par step (wizard), sinon une section unique (flat).
  const sections = steps.length
    ? steps.map((s, i) => ({ id: `step${i}`, label: s.title, fields: s.fields.map((f) => f.name) }))
    : [{ id: "main", fields: flat.map((f) => f.name) }];

  // costum : extrait de extraData.costumSlug (le scope passe ensuite par me.costum(slug)).
  const extra = (legacy.extraData ?? {}) as Record<string, unknown>;
  const costumSlug = typeof extra.costumSlug === "string" ? extra.costumSlug : undefined;

  // addressValid : si un champ adresse (location) est présent, brancher la validation cross-champ
  // (adresse saisie sans localityId → erreur) — clé du validateRegistry (cf. forms/validators).
  const hasLocation = Object.values(fields).some((f) => f.widget === "location");

  return {
    id: `legacy:${legacy.entityType ?? "organization"}`,
    ...(legacy.title ? { title: legacy.title } : {}),
    entityType: (legacy.entityType ?? "organization") as JsonFormConfig["entityType"],
    ...(costumSlug ? { costum: { slug: costumSlug } } : {}),
    layout: { kind: steps.length ? "wizard" : "flat" },
    i18n: "localized",
    sections,
    fields,
    ...(hasLocation ? { validateFn: "addressValid" } : {}),
    submit: {
      mode: legacy.submitMode ?? "sdk",
      ...(legacy.action ? { action: legacy.action } : {}),
      ...(legacy.method ? { method: legacy.method } : {}),
      ...(legacy.tagsFrom ? { tagsFrom: legacy.tagsFrom } : {}),
      ...(legacy.extraData ? { extraData: legacy.extraData } : {}),
      ...(legacy.successMessage ? { successMessage: legacy.successMessage } : {}),
      ...(legacy.errorMessage ? { errorMessage: legacy.errorMessage } : {}),
    },
    ...(legacy.submitLabel ? { submitLabel: legacy.submitLabel } : {}),
  };
}

/** Normalise une config (ancien OU nouveau format) en `JsonFormConfig`. */
export function toJsonFormConfig(raw: JsonFormConfig | JsonFormModalConfig): JsonFormConfig {
  return isJsonFormConfig(raw) ? raw : legacyToJsonFormConfig(raw as JsonFormModalConfig);
}
