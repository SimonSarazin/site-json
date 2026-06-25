/**
 * Contrat du moteur de formulaire générique (descriptor-driven).
 * cf. doc/moteur-formulaire-generique.md — §2 (contrat), §3 (conditionnel), §4 (widgets), §5 (layouts).
 *
 * Séparation : la couche DONNÉES (type/enum-values/path/required) vient de la lib (fiable) ;
 * la couche UI (widget/label/layout/conditionnel) est écrite ici (proprement, pas du legacy).
 */
import type { LocalizedString } from "@/types/locale-schema";

/** Libellé internationalisable : clé i18n string (résolue par i18next) OU LocalizedString inline `{fr,en,…}`
 *  (résolue locale-aware par `useLocalization`). Les deux passent par `useT` au rendu (cf. `WidgetProps.t`). */
export type I18n = string | LocalizedString;

/** Type logique d'un champ (vient de la lib : `schema.type` + `x-format`). */
export type FieldType = "string" | "number" | "boolean" | "date" | "array" | "object";

/** Widgets supportés (mappés vers des composants par le WidgetRegistry, §4). */
export type WidgetKind =
  | "hidden"
  | "text" | "email" | "tel" | "textarea" | "number"
  | "switch" | "checkbox" | "checkboxGroup"
  | "select" | "multiselect" | "selectFromLists"
  | "tags" | "date" | "datetime" | "time"
  | "urlList" | "image" | "location" | "openingHours"
  | "finder" | "eventDates" | "fieldArray" | "custom"
  // Composites edit-profil réutilisés tels quels (réseaux sociaux 9-grille, horaires d'ouverture org)
  | "editSocial" | "editSchedule";

export interface EnumOption {
  value: string;
  label: I18n;
}

// ── Conditionnel (§3) ───────────────────────────────────────────────────────
export type PredicateOp =
  | "eq" | "ne" | "in" | "nin"
  | "gt" | "gte" | "lt" | "lte"
  | "truthy" | "falsy" | "empty" | "notEmpty"
  | "matches" | "contains";

export type Predicate =
  | { field: string; op: PredicateOp; value?: unknown }
  | { and: Predicate[] }
  | { or: Predicate[] }
  | { not: Predicate };

/** Nom d'un transformer enregistré (read/write/computed), résolu par le TransformRegistry (§6). */
export type TransformName = string;

// ── Champ ───────────────────────────────────────────────────────────────────
export interface FieldDescriptor {
  // DONNÉES (lib)
  name: string;
  path?: string;                 // chemin de stockage si ≠ name (ex. "preferences.isOpenData")
  type: FieldType;
  enum?: EnumOption[];
  /** Options DYNAMIQUES par CLÉ de registre (`registerOptions`), résolues au RENDU — pour les listes calculées/
   *  datées (ex. années) qu'un `enum` statique figerait (cf. JSON config). Prioritaire après `enum`. */
  enumFrom?: string;
  multiple?: boolean;
  default?: unknown;
  // UI (site-json)
  widget: WidgetKind;
  label: I18n;
  placeholder?: I18n;
  placeholderSearch?: I18n;       // placeholder de la zone de recherche (select/multiselect)
  info?: I18n;
  widgetProps?: Record<string, unknown>;
  /** Clé d'une source d'options runtime (ex. `serverData.lists[optionsKey]`). Défaut : `name`. */
  optionsKey?: string;
  // Validation
  required?: boolean;
  rules?: {
    url?: boolean;
    min?: number; max?: number;
    minLength?: number; maxLength?: number;
    regex?: string;
  };
  /** Messages d'erreur PAR règle (déjà résolus). Sinon clé i18n par défaut (`validation.<règle>`).
   *  Permet à une config de porter ses propres messages (LocalizedString pré-résolu) — auto-suffisant. */
  messages?: Partial<Record<"required" | "url" | "min" | "max" | "minLength" | "maxLength" | "format", string>>;
  // Conditionnel (seuls visibleIf/requiredIf/computedFrom sont câblés par le moteur ;
  // ne pas déclarer de clé non implémentée — l'API mentirait au descripteur).
  visibleIf?: Predicate;
  requiredIf?: Predicate;
  computedFrom?: { deps: string[]; fn: TransformName };
  // Read / Write (transformers nommés)
  read?: TransformName;
  write?: TransformName;
  /** Valeur émise pour EFFACER ce champ (diff d'édition `fieldPipeline.diffForEdit`). Défaut dérivé du
   *  type : `[]` (array) sinon `""`. ⚠ Jamais `{}` (non reconnu comme clear par le SDK costum → no-op). */
  clear?: unknown;
  /** Id de GROUPE ATOMIQUE : si UN champ du groupe change, TOUT le groupe est (ré)émis ENSEMBLE au save —
   *  évite l'écrasement lossy (ex. adresse : level1..4/codeInsee/geo non relus). cf. fieldPipeline.diffForEdit. */
  atomicGroup?: string;
  /** Membre d'un GROUPE DE SÉRIALISATION (cf. `FormDescriptor.serializeGroups`) : N champs plats ↔ 1 objet
   *  serveur (ex. `address` 14 clés, `socialNetwork` 9 clés). Lu/écrit PAR le groupe, pas individuellement.
   *  EXCEPTION : si le groupe est `groupReadOnly`, le membre est LU par le groupe mais ÉCRIT individuellement. */
  group?: string;
  /** Champ WRITE-only : ignoré par `seedFromEntity` (READ), émis par `valuesToPayload` (ex. geo/geoPosition
   *  posés par EditLocationTab, jamais relus dans le form) → permet UN descripteur read+write par entité. */
  writeOnly?: boolean;
  /** Champ READ-only : seedé (READ) mais jamais émis au payload (ex. valeur d'affichage calculée). */
  readOnly?: boolean;
  /** Champ RENDER-only : pur ancrage UI, AUCUN mapping serveur → ignoré par `seedFromEntity` (READ) ET
   *  `valuesToPayload` (WRITE). Pour les widgets COMPOSITES qui pilotent d'AUTRES champs (ex. `location`
   *  écrit les champs plats d'adresse ; `image` traité hors element/save) → permet UN descripteur unifié
   *  render+pipeline sans que l'ancre composite ne pollue le payload. */
  renderOnly?: boolean;
}

// ── Sections & layout (§5) ────────────────────────────────────────────────────
/**
 * Sous-bloc de mise en page d'une section : une grille (1–3 colonnes), un titre
 * optionnel (ex. « Accessibilité PMR ») et une visibilité conditionnelle de bloc
 * (le bloc entier — titre compris — disparaît si `visibleIf` est faux).
 */
export interface FieldGroup {
  columns?: 1 | 2 | 3;           // grille responsive (sm:grid-cols-N) ; défaut 1
  label?: I18n;                  // titre de sous-bloc (optionnel)
  required?: boolean;            // affiche « * » à côté du titre du sous-bloc
  visibleIf?: Predicate;         // conditionne tout le bloc (titre + champs)
  divider?: boolean;             // séparateur haut (border-t + pt-6) — sous-bloc secondaire
  titleClassName?: string;       // classe CSS du titre (défaut "text-sm font-medium")
  fields: string[];              // ordre des champs ; "$slot:<id>" = section custom
}

export interface SectionDescriptor {
  id: string;
  label?: I18n;
  /** Icône de l'étape/onglet (nom lucide, ex. "building-2") — rendue par le stepper (variant visuel). */
  icon?: string;
  visibleIf?: Predicate;
  /** Format PLAT (rétro-compatible) : équivaut à un unique groupe 1 colonne. */
  fields?: string[];             // "$slot:<id>" = section custom (ex. doublons)
  /** Format GROUPES : grilles + sous-blocs à titre + conditionnel (cf. base form). */
  groups?: FieldGroup[];
}

/**
 * Présentation du stepper / header (variants VISUELS, sérialisables). Défaut = look « équipement » :
 * `stepper:"pills"`, `progress:"count"`, `header:"plain"`. Un form plus riche (ancien tiers-lieu) opte
 * pour `stepper:"tabs"` (onglets icône+label) + `progress:"bar"` + `header:"gradient"` (+ `section.icon`).
 */
export interface LayoutPresentation {
  /** Déclencheurs d'étapes : pastilles numérotées (défaut) | onglets larges (icône + libellé). */
  stepper?: "pills" | "tabs";
  /** Indicateur de progression (wizard) : « X/N » (défaut) | barre animée | aucun. */
  progress?: "count" | "bar" | "none";
  /** Bandeau d'en-tête : neutre (défaut) | dégradé. */
  header?: "plain" | "gradient";
}

export type LayoutSpec =
  | ({ kind: "flat" } & LayoutPresentation)
  | ({ kind: "tabs" } & LayoutPresentation)
  | ({ kind: "wizard"; validatePerStep?: boolean } & LayoutPresentation)
  | ({ kind: "accordion" } & LayoutPresentation)
  | { kind: string; [param: string]: unknown };

// ── Descripteur de formulaire ─────────────────────────────────────────────────
export type FormCollection = "poi" | "organizations" | "projects" | "events" | "citoyens";

export interface FormDescriptor {
  id: string;                    // ex. "equipements-sportifs"
  /** Icône du FORMULAIRE (badge de titre, nom lucide) — rendue par l'hôte modale à côté du titre. */
  icon?: string;
  collection: FormCollection;
  costumSlug?: string;           // si scopé costum (sinon entité de base)
  layout: LayoutSpec;
  sections: SectionDescriptor[];
  fields: Record<string, FieldDescriptor>;
  /** Validation CROSS-CHAMP (ce que `required`/`rules`/`requiredIf` par champ ne couvrent pas) :
   *  fonction inline OU **clé de `validateRegistry`** (config-driven) renvoyant `{ path, message }[]`
   *  (message = clé i18n). Ex. adresse saisie sans localityId. Résolu via `resolveValidate`. */
  validate?: string | ((values: FormValues) => Array<{ path: string; message: string }>);
  /** GROUPES DE SÉRIALISATION : N champs plats (membres via `field.group`) ↔ 1 clé/objet serveur.
   *  `read` (objet serveur → valeurs plates des membres) / `write` (valeurs de form → objet serveur,
   *  `undefined` = clé omise) sont des transformers nommés. `groupReadOnly` : le groupe DÉCOMPOSE au READ
   *  mais N'ÉCRIT PAS au niveau groupe (les membres sont alors émis INDIVIDUELLEMENT par leur propre `write`)
   *  — pour l'asymétrie profil `socialNetwork` (lu objet, écrit 9 clés plates). Subsume extractAddressFields/
   *  buildAddressFromForm, extractSocial/buildSocialNetwork, etc. cf. `fieldPipeline` + doc/refactor-field-treatment.md. */
  serializeGroups?: Record<string, { serverKey: string; read: TransformName; write: TransformName; groupReadOnly?: boolean; params?: Record<string, unknown> }>;
}

/** Valeurs de formulaire (plates, clé = name). */
export type FormValues = Record<string, unknown>;
