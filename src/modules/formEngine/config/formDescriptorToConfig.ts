/**
 * Sens INVERSE de `configToDescriptor` : `FormDescriptor` (moteur) → `JsonFormConfig` (sérialisable).
 * Permet la BIDIRECTIONNALITÉ — exporter un descripteur TS en config JSON (base de P5) et le round-trip
 * config → descriptor → config. cf. doc/formulaire-config-driven.md.
 *
 * LIMITE (par conception, sérialisabilité) : `validate` n'est repris que s'il est une CLÉ de registre
 * (string). Un `validate` fonction inline NE peut PAS être sérialisé → il faut d'abord l'enregistrer
 * sous une clé (`registerValidate`). Idem read/write/computedFrom.fn : déjà des clés → copiés tels quels.
 * Les libellés du descripteur sont des string (clés i18n ou texte) → la config sort en `i18n: "keys"`.
 */
import type { FieldDescriptor, FormCollection, FormDescriptor } from "../types";
import type { JsonFormConfig, JsonFormFieldConfig } from "./schema";

const COLLECTION_TO_ENTITY: Record<FormCollection, JsonFormConfig["entityType"]> = {
  organizations: "organization",
  projects: "project",
  events: "event",
  poi: "poi",
  citoyens: "citoyen",
};

function fieldToConfig(f: FieldDescriptor): JsonFormFieldConfig {
  return {
    type: f.type,
    widget: f.widget,
    label: f.label,
    ...(f.placeholder ? { placeholder: f.placeholder } : {}),
    ...(f.placeholderSearch ? { placeholderSearch: f.placeholderSearch } : {}),
    ...(f.info ? { info: f.info } : {}),
    ...(f.path ? { path: f.path } : {}),
    ...(f.default !== undefined ? { default: f.default } : {}),
    ...(f.multiple ? { multiple: f.multiple } : {}),
    ...(f.optionsKey ? { optionsKey: f.optionsKey } : {}),
    ...(f.enum ? { enum: f.enum.map((e) => ({ value: e.value, label: e.label })) } : {}),
    ...(f.required ? { required: f.required } : {}),
    ...(f.requiredIf ? { requiredIf: f.requiredIf } : {}),
    ...(f.visibleIf ? { visibleIf: f.visibleIf } : {}),
    ...(f.rules ? { rules: f.rules } : {}),
    ...(f.messages ? { messages: f.messages } : {}),
    ...(f.computedFrom ? { computedFrom: f.computedFrom } : {}),
    ...(f.read ? { read: f.read } : {}),
    ...(f.write ? { write: f.write } : {}),
    ...(f.widgetProps ? { widgetProps: f.widgetProps } : {}),
  } as JsonFormFieldConfig;
}

export function formDescriptorToConfig(d: FormDescriptor): JsonFormConfig {
  const fields: Record<string, JsonFormFieldConfig> = {};
  for (const [name, f] of Object.entries(d.fields)) fields[name] = fieldToConfig(f);

  return {
    id: d.id,
    entityType: COLLECTION_TO_ENTITY[d.collection],
    collection: d.collection,
    ...(d.costumSlug ? { costum: { slug: d.costumSlug } } : {}),
    layout: d.layout as JsonFormConfig["layout"],
    i18n: "keys", // les libellés du descripteur sont déjà des string (clés/texte)
    sections: d.sections.map((s) => ({
      id: s.id,
      ...(s.label ? { label: s.label } : {}),
      ...(s.visibleIf ? { visibleIf: s.visibleIf } : {}),
      ...(s.groups ? { groups: s.groups } : {}),
      ...(s.fields ? { fields: s.fields } : {}),
    })),
    fields,
    // validate sérialisable UNIQUEMENT si c'est une clé de registre (string) ; fonction inline ignorée.
    ...(typeof d.validate === "string" ? { validateFn: d.validate } : {}),
    submit: { mode: "sdk" },
  };
}
