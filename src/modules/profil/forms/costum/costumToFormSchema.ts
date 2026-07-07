/**
 * Génération BUILD-TIME d'un document `CostumFormSchema` — le format posable TEL QUEL dans
 * `config.costumForms.<id>` (compilé + gardé par `registerCostumForm` au boot) — depuis l'artefact
 * `costum-extensions.json` + la base curée de la lib (`describeEntityForm`). Pendant « costumForm »
 * de `costumToConfig` (qui émet la couche `JsonFormConfig`) — cf. doc/31 (fil A / phase F2),
 * consommé par `scripts/gen-costum-config.ts --format costumForm`.
 *
 * Le généré est un SQUELETTE DÉTERMINISTE à éditer (sections/wizard, libellés en, codecs fins) :
 *  - widgets DÉDUITS des types (inverse de `WIDGET_DEFAULTS` de compileCostumSchema) : enum→select/
 *    multiselect (options embarquées), array→tags, boolean→switch (convention du repo), number→number,
 *    date→date, string→text (textarea NON détectable : l'artefact ne porte ni longueur ni x-format long),
 *    object→hidden+type:"object" (aucun widget objet générique enregistré — ancre à retravailler) ;
 *  - AUCUNE clé de registre hors `sharedRegistrations` (codecs `address:read/write`, `image:profilUrl`,
 *    `invalidate:standard`, coercions dérivées des widgets) → `registerCostumForm` passe SANS fns métier ;
 *  - presets de l'artefact → `mutation.inject.extraFields` (STAMP create — convention du costumForm réel
 *    tiers-lieux). Les champs du même nom sont OMIS du form : l'injection écraserait la saisie
 *    (`Object.assign(payload, extraFields)` APRÈS le pipeline, cf. useEntityMutation) ;
 *  - `required` JAMAIS deviné pour les champs costum (l'artefact ne le porte pas) ; ceux de la base
 *    viennent de la curation lib (`name` requis…) ;
 *  - base `format:"address"` → pattern GROUPE du costumForm réel equipements-sportifs : ancre `location`
 *    + champs plats cachés (`group:"address"`) + `serializeGroups.address` (codec partagé) ;
 *  - base `format:"image"` → champ `widget:"image"` + bloc modale `image.existingUrlFrom:"image:profilUrl"`.
 */
import type { EntityFormDescriptor, BaseFieldDescriptor } from "@communecter/cocolight-api-client";
import type { EnumOption, SectionDescriptor } from "@/modules/formEngine";
import { fieldLabel } from "@/modules/formEngine/config/fieldLabels";
import {
  artifactFieldType,
  type CostumExtensionsArtifact,
  type CostumFieldArtifact,
} from "@/modules/formEngine/config/costumToConfig";
import type { CostumFormSchema, TerseField } from "./compileCostumSchema";

type Kind = CostumFormSchema["entityType"];

/** Collections créables via costumForm (vocabulaire PLURIEL `EntityKind`, convention des costumForms réels :
 *  tiers-lieux → `entityType:"organizations"`). */
const ENTITY_KINDS: readonly Kind[] = ["organizations", "projects", "events", "poi", "citoyens"];

/** Singulier des clés i18n toast (`toast.add.<sing>Success`) et des `errorContext` (ADD_<SING>). */
const SINGULAR: Record<Kind, string> = {
  organizations: "organization", projects: "project", events: "event", poi: "poi", citoyens: "citoyen",
};

/** collection → `params.userList` d'`invalidate:standard` (cf. USER_LIST_BUILDERS de sharedFns). */
const USER_LIST: Partial<Record<Kind, string>> = {
  organizations: "organizations", projects: "projects", events: "events", poi: "pois",
};

/** Champs plats du groupe adresse générés (sous-ensemble utile d'ADDRESS_KEYS — même liste que le
 *  costumForm réel equipements-sportifs ; les 9 clés SIG restent gérées par le codec `address:*`). */
const ADDRESS_GROUP_FIELDS = ["addressCountry", "addressLocality", "postalCode", "streetAddress", "localityId"] as const;

/** camelCase / espaces / `_` → kebab-case (id du document ; ex. `equipementsSportifs974` → `equipements-sportifs-974`). */
export function kebabCaseSlug(slug: string): string {
  return slug
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])([0-9])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

const enumOptions = (values: readonly unknown[]): EnumOption[] =>
  values.map((v) => ({ value: String(v), label: String(v) }));

/** Champ COSTUM (artefact) → champ TERSE : widget inverse de WIDGET_DEFAULTS, label catalogue/humanisé,
 *  `required` jamais deviné. */
function costumTerseField(f: CostumFieldArtifact): TerseField {
  const label = fieldLabel(f.name);
  const path = f.path && f.path !== f.name ? { path: f.path } : {};
  if (Array.isArray(f.enum) && f.enum.length > 0) {
    return { widget: f.multiple ? "multiselect" : "select", label, enum: enumOptions(f.enum), ...path };
  }
  switch (artifactFieldType(f)) {
    case "array": return { widget: "tags", label, ...path };
    case "boolean": return { widget: "switch", label, ...path };
    case "number": return { widget: "number", label, ...path };
    case "date": return { widget: "date", label, ...path };
    // Pas de widget objet générique enregistré (`custom` n'existe pas au registre) → ancre pass-through à éditer.
    case "object": return { widget: "hidden", type: "object", label, ...path };
    default: return { widget: "text", label, ...path };
  }
}

/** Champ de BASE (lib, curé) → champ TERSE. `format` sémantique prioritaire (même mapping que la voie
 *  JsonFormConfig) ; `address`/`image` sont traités PAR L'APPELANT (groupe de sérialisation / bloc image). */
function baseTerseField(f: BaseFieldDescriptor): TerseField {
  const label = fieldLabel(f.name, f.label);
  const req = f.required ? { required: true } : {};
  if (Array.isArray(f.enum) && f.enum.length > 0) {
    return { widget: f.multiple ? "multiselect" : "select", label, enum: enumOptions(f.enum), ...req };
  }
  switch (f.format) {
    case "email": return { widget: "email", label, ...req };
    case "tel": return { widget: "tel", label, ...req };
    case "url": return { widget: "text", label, rules: { url: true }, ...req };
    case "markdown": return { widget: "textarea", label, ...req };
    case "social": return { widget: "editSocial", label, ...req };
    case "openingHours": return { widget: "openingHours", label, ...req };
  }
  switch (f.type) {
    case "boolean": return { widget: "switch", label, ...req };
    case "number": return { widget: "number", label, ...req };
    case "date": return { widget: "date", label, ...req };
    case "array": return { widget: "tags", label, ...req };
    case "object": return { widget: "hidden", type: "object", label, ...req };
    default: return { widget: "text", label, ...req };
  }
}

/**
 * Artefact + base lib → `CostumFormSchema` complet (id kebab-case, sections base/costum, chrome squelette,
 * mutation générique). Retourne `null` si la collection n'est pas créable ou si `slug`/`collection` est
 * absent de l'artefact (mêmes gardes que `costumToConfig`).
 */
export function costumToFormSchema(
  extensions: CostumExtensionsArtifact,
  slug: string,
  collection: string,
  base?: EntityFormDescriptor | null,
): CostumFormSchema | null {
  if (!(ENTITY_KINDS as readonly string[]).includes(collection)) return null;
  const ext = extensions.costumExtensions?.[slug]?.[collection];
  if (!ext) return null;
  const kind = collection as Kind;

  const hidden = new Set(ext.hidden ?? []);
  const presets = ext.presets ?? {};
  const presetNames = new Set(Object.keys(presets));

  // Champs costum retenus : ni cachés (dynForm `hide`), ni stampés (preset → inject.extraFields, qui
  // écraserait la saisie au CREATE — contrairement à la voie JsonFormConfig où les presets passent AVANT data).
  const costumFields = (ext.fields ?? []).filter((f) => !hidden.has(f.name) && !presetNames.has(f.name));
  const costumNames = new Set(costumFields.map((f) => f.name));

  const fields: Record<string, TerseField> = {};
  const baseOrder: string[] = [];
  const costumOrder: string[] = [];
  let serializeGroups: CostumFormSchema["serializeGroups"];
  let image: CostumFormSchema["image"];

  for (const f of base?.fields ?? []) {
    if (costumNames.has(f.name) || hidden.has(f.name) || presetNames.has(f.name)) continue;
    if (f.format === "address") {
      serializeGroups = { ...(serializeGroups ?? {}), address: { serverKey: f.name, read: "address:read", write: "address:write" } };
      fields[f.name] = { widget: "location", label: fieldLabel(f.name, f.label) }; // ancre composite (renderOnly dérivé du widget)
      baseOrder.push(f.name);
      for (const m of ADDRESS_GROUP_FIELDS) {
        if (fields[m] || costumNames.has(m)) continue;
        fields[m] = { widget: "hidden", group: "address" };
        baseOrder.push(m);
      }
      continue;
    }
    if (f.format === "image") {
      fields[f.name] = { widget: "image", label: fieldLabel(f.name, f.label) }; // image hors element/save (bloc modale)
      image = { field: f.name, existingUrlFrom: "image:profilUrl" };
      baseOrder.push(f.name);
      continue;
    }
    fields[f.name] = baseTerseField(f);
    baseOrder.push(f.name);
  }
  for (const f of costumFields) {
    fields[f.name] = costumTerseField(f);
    costumOrder.push(f.name);
  }

  const sections: SectionDescriptor[] = [];
  if (baseOrder.length) sections.push({ id: "base", label: { fr: "Informations" }, fields: baseOrder });
  sections.push({
    id: "costum",
    ...(baseOrder.length ? { label: { fr: "Spécifique au costum" } } : {}),
    fields: costumOrder,
  });

  const sing = SINGULAR[kind];
  const userList = USER_LIST[kind];
  return {
    id: kebabCaseSlug(slug),
    entityType: kind,
    collection: kind,
    costumSlug: slug,
    layout: { kind: "flat" },
    ...(serializeGroups ? { serializeGroups } : {}),
    sections,
    fields,
    chrome: {
      title: { add: { fr: `Ajouter — ${slug}` }, edit: { fr: `Modifier — ${slug}` } },
      submitLabel: { add: { fr: ext.createLabel || "Créer" }, edit: { fr: "Enregistrer" } },
    },
    ...(image ? { image } : {}),
    mutation: {
      entityType: kind,
      ...(presetNames.size ? { inject: { extraFields: presets } } : {}),
      successKey: { add: `toast.add.${sing}Success`, edit: "toast.profile.updateSuccess" },
      errorKey: { add: `toast.add.${sing}Error`, edit: "toast.profile.updateError" },
      errorContext: { add: `EntityFormModal · ADD_${sing.toUpperCase()}`, edit: `EntityFormModal · UPDATE_${sing.toUpperCase()}` },
      ...(userList ? { invalidateFn: { fn: "invalidate:standard", params: { userList } } } : {}),
    },
  };
}
