/**
 * Génération de `JsonFormConfig` pour un costum, en DEUX couches (cf. doc/formulaire-config-driven.md) :
 *  - `descriptorToConfig(desc)` : cœur PUR, depuis un `CostumFormDescriptor` NEUTRE de la lib
 *    (alimenté soit par le RUNTIME `scope.describeForm()` — voie B/prod, soit par l'artefact build-time).
 *  - `costumToConfig(artefact, slug, collection)` : voie BUILD-TIME (voie A, dev) — lit
 *    `costum-extensions.json`, construit un descripteur, puis réutilise `descriptorToConfig` (zéro duplication).
 * Labels = nom brut (aucun libellé humain dans la source) → config éditable ensuite.
 */
import type { Collection, CostumFormDescriptor } from "@communecter/cocolight-api-client";
import type { FieldType } from "../types";
import type { JsonFormConfig, JsonFormFieldConfig } from "./schema";
import { defaultWidgetForType } from "./configToDescriptor";

/** collection (pluriel) → entityType (singulier). null = collection non créable via form. */
const COLLECTION_TO_ENTITY: Record<string, JsonFormConfig["entityType"]> = {
  organizations: "organization",
  projects: "project",
  events: "event",
  poi: "poi",
  citoyens: "citoyen",
};

/** CŒUR : descripteur costum NEUTRE (lib) → JsonFormConfig. Partagé runtime (describeForm) ET build-time. */
export function descriptorToConfig(desc: CostumFormDescriptor): JsonFormConfig | null {
  const entityType = COLLECTION_TO_ENTITY[desc.collection];
  if (!entityType) return null;

  const fields: Record<string, JsonFormFieldConfig> = {};
  const order: string[] = [];
  for (const f of desc.fields) {
    if (f.hidden) continue;
    const hasEnum = Array.isArray(f.enum) && f.enum.length > 0;
    fields[f.name] = {
      type: f.type as FieldType,
      widget: defaultWidgetForType(f.type as FieldType, f.multiple, hasEnum),
      label: f.name,
      ...(f.path && f.path !== f.name ? { path: f.path } : {}),
      ...(f.multiple ? { multiple: true } : {}),
      ...(hasEnum ? { enum: f.enum!.map((v) => ({ value: String(v), label: String(v) })) } : {}),
    };
    order.push(f.name);
  }

  return {
    id: `costum:${desc.slug}:${desc.collection}`,
    title: desc.slug,
    entityType,
    costum: { slug: desc.slug },
    layout: { kind: "flat" },
    i18n: "localized",
    sections: [{ id: "main", fields: order }],
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
 * Génère depuis l'artefact build-time (dev/CLI). Construit un `CostumFormDescriptor` puis réutilise
 * `descriptorToConfig`. Retourne `null` si collection non créable ou costum/collection absent.
 */
export function costumToConfig(
  extensions: CostumExtensionsArtifact,
  slug: string,
  collection: string,
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
    fields: (ext.fields ?? []).map((f) => ({
      name: f.name,
      path: f.path ?? f.name,
      type: artifactFieldType(f),
      multiple: f.multiple === true,
      ...(Array.isArray(f.enum) && f.enum.length ? { enum: f.enum } : {}),
      hidden: hidden.has(f.name),
    })),
  };
  return descriptorToConfig(desc);
}
