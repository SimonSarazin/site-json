/**
 * Adaptateur PUR `JsonFormConfig → FormDescriptor`. Aucune dépendance React. Mappe types→widgets,
 * pré-résout l'i18n (LocalizedString→string via `tLoc`), passe rules/visibleIf/requiredIf tels quels
 * (déjà au format moteur). Les parties non sérialisables (validate/payload) sont résolues par CLÉ ailleurs
 * (P1/P2) — ici on ne touche qu'au rendu + validation par champ. cf. doc/formulaire-config-driven.md (P0).
 */
import type { LocalizedString } from "@/types/locale-schema";
import type {
  EnumOption, FieldDescriptor, FieldGroup, FieldType, FormCollection, FormDescriptor,
  Predicate, SectionDescriptor, WidgetKind,
} from "../types";
import type { JsonFormConfig, JsonFormLabel } from "./schema";

/** entityType (singulier, côté SDK) → collection (pluriel, FormDescriptor). */
const ENTITY_TO_COLLECTION: Record<string, FormCollection> = {
  organization: "organizations",
  project: "projects",
  event: "events",
  poi: "poi",
  citoyen: "citoyens",
};

export interface ConfigToDescriptorOpts {
  /** Résout un LocalizedString vers la langue courante (fourni par le host via useLocalization). */
  tLoc: (loc: LocalizedString) => string;
}

/** Libellé config → string : clé i18n (string) passée telle quelle ; LocalizedString pré-résolu. */
function resolveLabel(value: JsonFormLabel | undefined, tLoc: ConfigToDescriptorOpts["tLoc"]): string | undefined {
  if (value == null) return undefined;
  return typeof value === "string" ? value : tLoc(value);
}

export function configToDescriptor(config: JsonFormConfig, opts: ConfigToDescriptorOpts): FormDescriptor {
  const tLoc = opts.tLoc;

  const fields: Record<string, FieldDescriptor> = {};
  for (const [name, f] of Object.entries(config.fields)) {
    fields[name] = {
      name,
      type: f.type as FieldType,
      widget: f.widget as WidgetKind,
      label: resolveLabel(f.label, tLoc) ?? "",
      placeholder: resolveLabel(f.placeholder, tLoc),
      placeholderSearch: resolveLabel(f.placeholderSearch, tLoc),
      info: resolveLabel(f.info, tLoc),
      path: f.path,
      default: f.default,
      multiple: f.multiple,
      optionsKey: f.optionsKey,
      enum: f.enum?.map((e): EnumOption => ({ value: e.value, label: resolveLabel(e.label, tLoc) ?? e.value })),
      required: f.required,
      requiredIf: f.requiredIf as Predicate | undefined,
      visibleIf: f.visibleIf as Predicate | undefined,
      rules: f.rules,
      messages: f.messages
        ? Object.fromEntries(
            Object.entries(f.messages)
              .map(([k, val]) => [k, resolveLabel(val as JsonFormLabel, tLoc)])
              .filter(([, val]) => val != null),
          )
        : undefined,
      computedFrom: f.computedFrom,
      read: f.read,
      write: f.write,
      widgetProps: f.widgetProps,
    };
  }

  const sections: SectionDescriptor[] = config.sections.map((s) => ({
    id: s.id,
    label: resolveLabel(s.label, tLoc),
    icon: s.icon,
    visibleIf: s.visibleIf as Predicate | undefined,
    fields: s.fields,
    groups: s.groups?.map((g): FieldGroup => ({
      columns: g.columns,
      label: resolveLabel(g.label, tLoc),
      required: g.required,
      visibleIf: g.visibleIf as Predicate | undefined,
      divider: g.divider,
      titleClassName: g.titleClassName,
      fields: g.fields,
    })),
  }));

  return {
    id: config.id,
    icon: config.icon,
    collection: config.collection ?? ENTITY_TO_COLLECTION[config.entityType] ?? "citoyens",
    costumSlug: config.costum?.slug,
    layout: config.layout,
    sections,
    fields,
    // `validate` = clé de registre (résolue par zodGen/GenericForm via resolveValidate → getValidate).
    ...(config.validateFn ? { validate: config.validateFn } : {}),
  };
}

/** Widget par défaut déduit du type (amorçage des configs générées depuis un schéma costum — cf. P4). */
export function defaultWidgetForType(type: FieldType, multiple?: boolean, hasEnum?: boolean): WidgetKind {
  if (hasEnum) return multiple ? "multiselect" : "select";
  switch (type) {
    case "boolean": return "switch";
    case "number": return "number";
    case "date": return "date";
    case "array": return "tags";
    case "object": return "custom";
    default: return "text";
  }
}

/**
 * Table inputType (dynForm legacy / coform) → WidgetKind. Écrite UNE fois ici (le legacy n'a aucune
 * table). Utilisée par le générateur costum (P4) et la migration. Non exhaustive — étendre au besoin.
 */
export const INPUT_TYPE_TO_WIDGET: Record<string, WidgetKind> = {
  text: "text", textarea: "textarea", email: "email", tel: "tel", number: "number", url: "text",
  date: "date", codate: "date", datetime: "datetime",
  select: "select", select2: "select", multiselect: "multiselect", checkboxList: "checkboxGroup",
  checkbox: "checkbox", boolean: "switch", tags: "tags",
  finder: "finder", uploader: "image", image: "image",
  location: "location", formLocality: "location", address: "location",
  openingHours: "openingHours",
};
