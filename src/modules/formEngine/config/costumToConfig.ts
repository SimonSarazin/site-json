/**
 * Génération de `JsonFormConfig` pour un costum, en composant BASE (entité) + OVERLAY (costum) — cf.
 * doc/formulaire-config-driven.md.
 *  - `descriptorToConfig(desc, base?)` : cœur PUR. `desc` = overlay costum NEUTRE de la lib
 *    (`scope.describeForm`, voie B/prod, OU artefact build-time). `base` = `EntityFormDescriptor`
 *    NEUTRE de la lib (`describeEntityForm`, curé une fois par entité). On COMPOSE (jamais de base
 *    dupliquée par costum) : section « base » puis section « costum ».
 *  - `costumToConfig(artefact, slug, collection, base?)` : voie BUILD-TIME (voie A, dev/CLI).
 *
 * Séparation lib/site : la lib produit des champs NEUTRES (type/enum/label/format) ; le site mappe
 * `format → widget` (la lib ne connaît pas le vocabulaire UI). Labels base = curés (lib) ; labels
 * costum = nom brut (la source costum n'en a pas) → à raffiner par convention i18n.
 */
import type {
  Collection,
  CostumFormDescriptor,
  EntityFormDescriptor,
  BaseFieldDescriptor,
  EntityFieldFormat,
} from "@communecter/cocolight-api-client";
import type { FieldType, WidgetKind } from "../types";
import type { JsonFormConfig, JsonFormFieldConfig } from "./schema";
import { defaultWidgetForType } from "./configToDescriptor";
import { fieldLabel } from "./fieldLabels";

/** collection (pluriel) → entityType (singulier). null = collection non créable via form. */
const COLLECTION_TO_ENTITY: Record<string, JsonFormConfig["entityType"]> = {
  organizations: "organization",
  projects: "project",
  events: "event",
  poi: "poi",
  citoyens: "citoyen",
};

/** `format` sémantique (lib, neutre) → `widget` (vocabulaire UI du site). */
const FORMAT_WIDGET: Record<EntityFieldFormat, WidgetKind> = {
  email: "email",
  tel: "tel",
  url: "text",
  markdown: "textarea",
  address: "location",
  image: "image",
  social: "editSocial",
  openingHours: "openingHours",
};

/** Champ de BASE neutre (lib) → champ de config (widget résolu via `format`, sinon défaut par type). */
function baseFieldToConfig(f: BaseFieldDescriptor): JsonFormFieldConfig {
  const hasEnum = Array.isArray(f.enum) && f.enum.length > 0;
  const widget = f.format ? FORMAT_WIDGET[f.format] : defaultWidgetForType(f.type as FieldType, f.multiple, hasEnum);
  return {
    type: f.type as FieldType,
    widget,
    label: fieldLabel(f.name, f.label),
    ...(f.multiple ? { multiple: true } : {}),
    ...(hasEnum ? { enum: f.enum!.map((v) => ({ value: String(v), label: String(v) })) } : {}),
    ...(f.required ? { required: true } : {}),
    ...(f.format === "url" ? { rules: { url: true } } : {}), // valide l'URL (le widget "url" n'a pas de validation propre)
  };
}

/**
 * CŒUR : overlay costum NEUTRE (lib) [+ base entité optionnelle] → JsonFormConfig. Partagé runtime
 * (describeForm) ET build-time. Si `base` fourni, ses champs (curés lib) sont injectés AVANT le costum :
 * section « base » puis « costum ». Le costum l'emporte sur collision de nom ; les champs base couverts
 * par un preset costum sont omis (auto-posés, ex. role/mainTag).
 */
export function descriptorToConfig(desc: CostumFormDescriptor, base?: EntityFormDescriptor): JsonFormConfig | null {
  const entityType = COLLECTION_TO_ENTITY[desc.collection];
  if (!entityType) return null;

  const costumFields: Record<string, JsonFormFieldConfig> = {};
  const costumOrder: string[] = [];
  for (const f of desc.fields) {
    if (f.hidden) continue;
    const hasEnum = Array.isArray(f.enum) && f.enum.length > 0;
    costumFields[f.name] = {
      type: f.type as FieldType,
      widget: defaultWidgetForType(f.type as FieldType, f.multiple, hasEnum),
      label: fieldLabel(f.name),
      ...(f.path && f.path !== f.name ? { path: f.path } : {}),
      ...(f.multiple ? { multiple: true } : {}),
      ...(hasEnum ? { enum: f.enum!.map((v) => ({ value: String(v), label: String(v) })) } : {}),
    };
    costumOrder.push(f.name);
  }

  // Base : retirer les champs overridés par le costum OU MASQUÉS par le costum (legacy dynForm `hide` :
  // type/tags/role… pour tiers-lieu). NB : un preset n'est PAS un masquage — c'est un défaut surchargeable
  // (jsonFormSubmit applique presets AVANT data) ; on ne retire donc PAS les champs sur le seul critère preset.
  const costumNames = new Set(costumOrder);
  const hiddenNames = new Set(desc.hidden ?? []);
  const baseFields: Record<string, JsonFormFieldConfig> = {};
  const baseOrder: string[] = [];
  for (const f of base?.fields ?? []) {
    if (costumNames.has(f.name) || hiddenNames.has(f.name)) continue;
    baseFields[f.name] = baseFieldToConfig(f);
    baseOrder.push(f.name);
  }

  const fields: Record<string, JsonFormFieldConfig> = {};
  for (const n of baseOrder) fields[n] = baseFields[n];
  for (const n of costumOrder) fields[n] = costumFields[n];

  const sections: NonNullable<JsonFormConfig["sections"]> = [];
  if (baseOrder.length) sections.push({ id: "base", label: { fr: "Informations" }, fields: baseOrder });
  sections.push({
    id: "costum",
    ...(baseOrder.length ? { label: { fr: "Spécifique au costum" } } : {}),
    fields: costumOrder,
  });

  return {
    id: `costum:${desc.slug}:${desc.collection}`,
    title: desc.slug,
    entityType,
    costum: { slug: desc.slug },
    layout: { kind: "flat" },
    i18n: "localized",
    sections,
    fields,
    submit: {
      mode: "sdk",
      ...(desc.presets && Object.keys(desc.presets).length ? { presets: desc.presets } : {}),
    },
    ...(desc.createLabel ? { submitLabel: desc.createLabel } : {}),
  };
}

// ── Voie BUILD-TIME (voie A) : artefact costum-extensions.json → descripteur → config ───────────
interface CostumFieldArtifact {
  name: string;
  path?: string;
  schema?: { type?: string; format?: string; "x-format"?: string; oneOf?: unknown[] };
  enum?: string[];
  multiple?: boolean;
}
interface CostumCollectionArtifact {
  fields?: CostumFieldArtifact[];
  presets?: Record<string, unknown>;
  hidden?: string[];
  add?: boolean;
  createLabel?: string | null;
}
export interface CostumExtensionsArtifact {
  costumExtensions?: Record<string, Record<string, CostumCollectionArtifact>>;
}

/** Type logique d'un champ depuis son schema d'artefact (multiple → array ; x-format date → date). */
function artifactFieldType(f: CostumFieldArtifact): FieldType {
  if (f.multiple) return "array";
  const s = f.schema ?? {};
  if (s.format === "date" || s["x-format"] === "date") return "date";
  switch (s.type) {
    case "number": case "integer": return "number";
    case "boolean": return "boolean";
    case "array": return "array";
    case "object": return "object";
    default: return "string";
  }
}

/**
 * Génère depuis l'artefact build-time (dev/CLI). Construit le descripteur overlay costum puis réutilise
 * `descriptorToConfig`. Si `base` (= `describeEntityForm(collection)` de la lib) est fourni, INJECTE les
 * champs de base de l'entité → config complète base+costum. Retourne `null` si collection non créable
 * ou costum/collection absent.
 */
export function costumToConfig(
  extensions: CostumExtensionsArtifact,
  slug: string,
  collection: string,
  base?: EntityFormDescriptor | null,
): JsonFormConfig | null {
  const ext = extensions.costumExtensions?.[slug]?.[collection];
  if (!ext) return null;
  const hidden = new Set(ext.hidden ?? []);
  const desc: CostumFormDescriptor = {
    slug,
    collection: collection as Collection,
    costumId: "",
    costumType: "",
    add: ext.add ?? false,
    createLabel: ext.createLabel ?? null,
    presets: ext.presets ?? {},
    hidden: ext.hidden ?? [],
    fields: (ext.fields ?? []).map((f) => ({
      name: f.name,
      path: f.path ?? f.name,
      type: artifactFieldType(f),
      multiple: f.multiple === true,
      ...(Array.isArray(f.enum) && f.enum.length ? { enum: f.enum } : {}),
      hidden: hidden.has(f.name),
    })),
  };
  return descriptorToConfig(desc, base ?? undefined);
}
