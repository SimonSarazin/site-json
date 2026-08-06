/**
 * Compilateur GÉNÉRIQUE d'un document costum FUSIONNÉ (form + modal) → `{ descriptor, spec }`.
 *
 * Un seul document `CostumFormSchema` décrit TOUT une entité costum (cf. `<entity>/schema.ts`) :
 *  - moitié FORM : `fields` TERSE (widget-driven : type/read/default DÉRIVÉS du widget), `sections`,
 *    `serializeGroups`, `layout` → `FormDescriptor` (consommé par le moteur GenericForm + pipeline).
 *  - moitié MODAL : `chrome`/`scope`/`mutation`/`slots`/`image`/`cleanValues` → `EntityModalSpec`
 *    (consommée par `resolveModalSpec` → modale rendue + mutée).
 *
 * Le document est 100 % DONNÉES + CLÉS de registre (read/write/scope/payload/slots… = strings enregistrées
 * dans `<entity>/fns.ts`) → posable tel quel dans une table TS OU la config globale JSON. Aucune closure.
 *
 * DÉRIVATION (le « commun » qui évite de re-déclarer type/read/default) : `WIDGET_DEFAULTS` mappe widget →
 * {type, read, default} (ce que portaient les ex-constructeurs `text/sel/sw/date/num/cbg`). Tout est
 * OVERRIDABLE — par `fieldPresets[widget]` (défaut par widget, ex. placeholderSearch des selects) puis par
 * le champ lui-même. Conventions : `label` ⇐ nom si absent ; placeholder d'un select ⇐ son label.
 * Byte-parité gardée par `<entity>/compiled.byteparity.test` (snapshot descriptor + spec).
 */
import type {
  FieldDescriptor, FormCollection, FormDescriptor, I18n, LayoutSpec, SectionDescriptor, WidgetKind,
} from "@/modules/formEngine";
import type { EntityModalSpec, SpecMutation, FnRef } from "../entityModalSpec";

/** Champ TERSE : le widget est requis, tout le reste est un OVERRIDE optionnel des défauts du widget. */
export type TerseField = { widget: WidgetKind } & Partial<Omit<FieldDescriptor, "name" | "widget">>;

/** Document costum FUSIONNÉ — la source unique d'une entité costum (form + modal). */
export interface CostumFormSchema {
  // ── identité / form ──
  id: string;
  entityType: SpecMutation["entityType"];
  /** collection FormDescriptor ; dérivée d'`entityType` si absente. */
  collection?: FormCollection;
  /** Icône du FORMULAIRE (badge de titre, nom lucide) → descriptor.icon ; défaut aussi de l'icône de modale. */
  icon?: string;
  /** slug costum statique du descripteur (= scope.defaults.sourceKey, source unique). */
  costumSlug?: string;
  /** Dériver un `field.default` du widget (string→"", bool→false, array→[]). Défaut TRUE. Mettre FALSE quand
   *  le socle vient d'une fn enregistrée (`defaultsBase`) et qu'aucun champ ne porte de défaut (ex. tiers-lieu). */
  deriveDefaults?: boolean;
  layout: LayoutSpec;
  serializeGroups?: FormDescriptor["serializeGroups"];
  /** clé → `validateRegistry` (validation cross-champ). */
  validateFn?: string;
  /** Défauts appliqués à TOUS les champs d'un widget (overridables par champ). Ex. placeholderSearch des selects. */
  fieldPresets?: Partial<Record<WidgetKind, Partial<TerseField>>>;
  sections: SectionDescriptor[];
  fields: Record<string, TerseField>;

  // ── modal (chrome + comportement) ──
  chrome: {
    title: { add: I18n; edit: I18n };
    description?: { add?: I18n; edit?: I18n };
    submitLabel?: { add: I18n; edit: I18n };
    icon?: string;
    gradientHeader?: boolean;
    dialogClassName?: string;
    validationFailedKey?: I18n;
    navText?: EntityModalSpec["navText"];
  };
  descriptorVariant?: string;
  image?: EntityModalSpec["image"];
  listsFromCarrier?: boolean;
  scope?: EntityModalSpec["scope"];
  /** clé → `defaultsRegistry` (socle structuré/scope-aware) ; absent → buildConfigDefaults. */
  defaultsBase?: string;
  slots?: Record<string, string>;
  schemaFn?: string;
  cleanValues?: FnRef;
  afterSubmit?: string;
  mutation: SpecMutation;
}

const ENTITY_TO_COLLECTION: Record<string, FormCollection> = {
  organization: "organizations", project: "projects", event: "events", poi: "poi", citoyen: "citoyens",
};

/** widget → défauts {type, read, default}. Le « commun » des ex-constructeurs. Overridable partout. */
const WIDGET_DEFAULTS: Partial<Record<WidgetKind, Partial<FieldDescriptor>>> = {
  text: { type: "string", read: "coerce:string", default: "" },
  textarea: { type: "string", read: "coerce:string", default: "" },
  email: { type: "string", read: "coerce:string", default: "" },
  tel: { type: "string", read: "coerce:string", default: "" },
  select: { type: "string", read: "coerce:string", default: "" },
  selectFromLists: { type: "string", read: "coerce:string", default: "" },
  switch: { type: "boolean", read: "coerce:bool", default: false },
  checkbox: { type: "boolean", read: "coerce:bool", default: false },
  date: { type: "date", read: "coerce:dateYMDlocale", default: "" },
  number: { type: "number", read: "coerce:number" }, // pas de default (→ undefined)
  checkboxGroup: { type: "array", read: "coerce:stringArray", default: [] },
  tags: { type: "array", read: "coerce:stringArray", default: [] },
  multiselect: { type: "array", read: "coerce:stringArray", default: [] },
  urlList: { type: "array", read: "coerce:stringArray", default: [] },
  image: { type: "object", renderOnly: true },     // ancre UI composite (image hors element/save)
  file: { type: "object", renderOnly: true },      // documents : uploadés post-save (processGalleryFields), hors element/save
  location: { type: "object", renderOnly: true },  // ancre UI composite (adresse via serializeGroups)
  // Les DEUX ancres qui manquaient ici, alors que mergeRenderPipeline les nomme dans la même phrase que
  // `location` et `eventDates` : une ancre rend une UI composite et ne porte AUCUNE donnée propre, elle
  // ne doit donc jamais être sérialisée. `editSocial` pilote les 9 clés facebook/twitter/… (EditSocialTab),
  // `editSchedule` pilote `openingHours` (EditScheduleTab) — jamais la clé du champ qui les porte.
  // Sans `renderOnly`, un formulaire costum utilisant ces widgets émettait la clé de l'ancre, vide. C'est
  // exactement ce qui rendait muettes les sections « Réseaux sociaux » de 4 formulaires (2026-07-30).
  editSocial: { type: "object", renderOnly: true },
  editSchedule: { type: "object", renderOnly: true },
  fieldArray: { type: "array" },                    // liste répétée GÉNÉRIQUE → pas de codec par widget (le sens dépend du champ)
  openingHours: { type: "object", read: "openingHours:read", write: "openingHours:write" }, // codec livré par le widget (cf. sharedCodecs)
  eventDates: { renderOnly: true },                 // ancre UI composite (dates event) : gère startDate/endDate/recurrency/openingHours ; JAMAIS sérialisée elle-même
  hidden: { type: "string" },                       // type par défaut ; sur-écrit si array/object
};

const SELECT_LIKE = new Set<WidgetKind>(["select", "selectFromLists"]);
const cloneDefault = (v: unknown): unknown => (Array.isArray(v) ? [...v] : v);

/** Terse + défauts du widget + preset → FieldDescriptor complet (champ explicite > preset > widget). */
function buildField(name: string, terse: TerseField, presets: CostumFormSchema["fieldPresets"], deriveDefaults: boolean): FieldDescriptor {
  const widget = terse.widget;
  const base = { ...(WIDGET_DEFAULTS[widget] ?? {}) };
  const preset = { ...(presets?.[widget] ?? {}) };
  // Membre d'un GROUPE de sérialisation : lu/écrit PAR le groupe (cf. serializeGroups) → aucun read/write/
  // default INDIVIDUEL dérivé (un read/write EXPLICITE du champ reste appliqué via `terse`).
  if (terse.group) {
    delete base.read; delete base.write; delete base.default;
    delete preset.read; delete preset.write; delete preset.default;
  }
  // Défauts dérivés OFF : aucun field.default (le socle vient de `defaultsBase`). cf. tiers-lieu.
  if (!deriveDefaults) { delete base.default; delete preset.default; }
  const merged = { name, ...base, ...preset, ...terse } as FieldDescriptor;
  if ("default" in merged) merged.default = cloneDefault(merged.default); // éviter le partage de réf (arrays)
  if (merged.label == null) merged.label = name;                          // parité L(name) = LABELS[name] ?? name
  if (SELECT_LIKE.has(widget) && merged.placeholder == null) merged.placeholder = merged.label; // parité `sel`
  return merged;
}

function buildDescriptor(s: CostumFormSchema): FormDescriptor {
  const deriveDefaults = s.deriveDefaults !== false;
  const fields: Record<string, FieldDescriptor> = {};
  for (const [name, terse] of Object.entries(s.fields)) fields[name] = buildField(name, terse, s.fieldPresets, deriveDefaults);
  return {
    id: s.id,
    ...(s.icon ? { icon: s.icon } : {}),
    collection: s.collection ?? ENTITY_TO_COLLECTION[s.entityType] ?? "citoyens",
    ...(s.costumSlug ? { costumSlug: s.costumSlug } : {}),
    layout: s.layout,
    sections: s.sections,
    fields,
    ...(s.serializeGroups ? { serializeGroups: s.serializeGroups } : {}),
    ...(s.validateFn ? { validate: s.validateFn } : {}),
  };
}

function buildSpec(s: CostumFormSchema): EntityModalSpec {
  const c = s.chrome;
  const icon = c.icon ?? s.icon; // l'icône de modale retombe sur celle du formulaire (badge de titre)
  return {
    id: s.id,
    descriptor: { ref: s.id },
    ...(s.descriptorVariant ? { descriptorVariant: s.descriptorVariant } : {}),
    title: c.title,
    ...(c.description ? { description: c.description } : {}),
    ...(c.submitLabel ? { submitLabel: c.submitLabel } : {}),
    ...(icon ? { icon } : {}),
    ...(c.gradientHeader ? { gradientHeader: c.gradientHeader } : {}),
    ...(c.dialogClassName ? { dialogClassName: c.dialogClassName } : {}),
    ...(c.validationFailedKey ? { validationFailedKey: c.validationFailedKey } : {}),
    ...(c.navText ? { navText: c.navText } : {}),
    ...(s.defaultsBase ? { defaults: { base: s.defaultsBase } } : {}),
    ...(s.image ? { image: s.image } : {}),
    ...(s.listsFromCarrier ? { listsFromCarrier: s.listsFromCarrier } : {}),
    ...(s.scope ? { scope: s.scope } : {}),
    ...(s.slots ? { slots: s.slots } : {}),
    ...(s.schemaFn ? { schemaFn: s.schemaFn } : {}),
    mutation: s.mutation,
    ...(s.afterSubmit ? { afterSubmit: s.afterSubmit } : {}),
    ...(s.cleanValues ? { cleanValues: s.cleanValues } : {}),
  };
}

/** Compile le document fusionné en descripteur (moteur) + spec modale (résolveur). */
export function compileCostumSchema(s: CostumFormSchema): { descriptor: FormDescriptor; spec: EntityModalSpec } {
  return { descriptor: buildDescriptor(s), spec: buildSpec(s) };
}
