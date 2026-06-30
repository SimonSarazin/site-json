/**
 * `EntityModalSpec` — description SÉRIALISABLE d'une modale d'entité (add+edit) : uniquement des DONNÉES et
 * des CLÉS de registre, AUCUNE closure. C'est le formalisme cible unique (même forme pour tiers-lieu /
 * poi-équipement / standard) : le descripteur est la SOURCE (zod généré + defaults dérivés), et tout code
 * irréductible (payload de création, scope costum, slots, schéma externe…) est référencé par CLÉ string et
 * enregistré côté domaine (cf. `specRegistries.ts` + `forms/costum/<entity>/fns.ts`).
 *
 * Conséquence : une `EntityModalSpec` est posable telle quelle dans une table TS (`modalSpecs`) OU dans la
 * config globale JSON — comportement runtime identique (le résolveur `resolveModalSpec` la rend). cf. plan
 * `~/.claude/plans/streamed-snuggling-glacier.md`.
 */
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { JsonFormConfig, I18n } from "@/modules/formEngine";
import type { EntityKind } from "../hooks/useEntityMutation";

/** Contexte runtime passé aux fns enregistrées (mode/entité/parent/scope/me/carrier/costum). */
export interface EntityModalCtx {
  mode: "add" | "edit";
  /** edit : l'entité éditée ; add : null. */
  entity?: EntityTypes | null;
  /** add : entité parente éventuelle. */
  parent?: EntityTypes | null;
  /** scope costum résolu (clé `scope.derive`). */
  scope?: unknown;
  /** utilisateur connecté. */
  me?: EntityTypes | null;
  /** entité PORTEUSE du costum (`useCocolight().entity`). */
  carrier?: EntityTypes | null;
  /** contexte costum du site (`useSite().config.costum`). */
  costum?: unknown;
}

/** Référence à un descripteur : enregistré par `id` (TS, via `registerDescriptor`) OU `JsonFormConfig` embarquée (JSON). */
export type DescriptorRef = { ref: string } | { config: JsonFormConfig };

/** Référence à une fn de registre : clé string seule, OU clé + `params` (DONNÉES) pour une fn générique
 *  paramétrée (ex. `cleanValues:dropEmptyArrayItems` + {fields}). Les deux formes sont JSON-able. */
export type FnRef = string | { fn: string; params?: Record<string, unknown> };

/** Valeur identique pour add+edit, OU distincte par mode (ex. successKey/errorContext add≠edit). */
export type ByMode<T> = T | { add: T; edit: T };

/** Injection de CRÉATION (drapeaux DONNÉES ; les valeurs runtime parent/organizer sont prises du ctx par le résolveur). */
export interface SpecInject {
  /** payload.role = values.role si présent (org/projet/event). */
  role?: boolean;
  /** buildParentReference(ctx.parent) → payload.parent. */
  parent?: boolean;
  /** organizer vide → buildOrganizerReference(ctx.parent, ctx.me) (event). */
  organizerFallback?: boolean;
  /** supprime payload.email === "" (ADD_ORGANIZATION). */
  dropEmptyEmail?: boolean;
  /** valeurs fixes ajoutées au payload au CREATE (STAMP costum statique). */
  extraFields?: Record<string, unknown>;
  /** STAMP depuis le scope résolu : { champPayload: cléScope } → payload[champ] = ctx.scope[cléScope].
   *  Évite de dupliquer une valeur déjà dans `scope.defaults` (ex. poi : { type: "poiType" }). */
  extraFieldsFromScope?: Record<string, string>;
}

/** Bloc WRITE : DONNÉES + clé `payloadFn` (défaut = pipeline) + clé `invalidateFn`. */
export interface SpecMutation {
  entityType: EntityKind;
  /** clé → `payloadRegistry` ; ABSENT → pipeline générique (`buildPipelinePayload`). */
  payloadFn?: string;
  /** édition via pipeline : émettre les vides typés (`buildEditPayload`). Défaut false (création). */
  payloadEmitEmptyOnEdit?: boolean;
  inject?: SpecInject;
  navigateOnSuccess?: boolean;
  successKey: ByMode<string>;
  errorKey: ByMode<string>;
  errorContext: ByMode<string>;
  /** clé → `invalidateRegistry` : (ctx, params?) => QueryKey[] ; ou {fn, params} pour la fn générique paramétrée. */
  invalidateFn?: FnRef;
}

/** Spec déclarative SÉRIALISABLE d'une modale d'entité. */
export interface EntityModalSpec {
  id: string;
  descriptor: DescriptorRef;
  /** clé → `descriptorVariantRegistry` (event hasParent / edit-profil byType) ; sinon descripteur brut. */
  descriptorVariant?: string;

  // ── chrome (DONNÉES) ── libellés = clé i18n string OU LocalizedString inline {fr,en} (résolus par useT au rendu).
  title: { add: I18n; edit: I18n };
  description?: { add?: I18n; edit?: I18n };
  submitLabel?: { add: I18n; edit: I18n };
  icon?: string;
  gradientHeader?: boolean;
  dialogClassName?: string;
  validationFailedKey?: I18n;
  /** libellés de navigation wizard. `stepLabelKey` = clé i18n INTERPOLÉE {index}/{total} → reste une clé string
   *  (useLocalization n'interpole pas) ; `next`/`previous`/`cancel` et `stepTemplate` (mots concaténés) = I18n. */
  navText?: {
    next?: I18n; previous?: I18n; cancel?: I18n;
    stepLabelKey?: string;
    stepTemplate?: { stepKey: I18n; ofKey: I18n };
  };

  // ── read ──
  /** `base` = clé → `defaultsRegistry` (socle structuré/scope-aware) ; absent → `buildConfigDefaults(config)`. */
  defaults?: { base?: string };

  // ── image ──
  image?: { field: string; existingUrlFrom?: string };

  // ── options runtime (selects) ──
  listsFromCarrier?: boolean;

  // ── scope costum ──
  /** slugFrom : où prendre le slug costum de création — `carrier` (slug du porteur), `derived` (champ
   *  `slugKey` de l'objet scope produit par `derive`), `constant`. `derive` = clé → `scopeRegistry`.
   *  `defaults` = valeurs de scope du costum (DONNÉE de config : parentId/sourceKey/poiType/addressCountry…),
   *  passées au `derive` (fallback quand le carrier ne fournit pas la valeur). */
  scope?: { slugFrom?: "carrier" | "derived" | "constant"; slugKey?: string; constant?: string; derive?: string; defaults?: Record<string, unknown> };

  // ── slots (id de slot → clé registre) ──
  slots?: Record<string, string>;

  // ── validation externe (clé → `schemaRegistry`) ; sinon zod auto du descripteur ──
  schemaFn?: string;

  // ── write ──
  mutation: SpecMutation;

  // ── effets (clés optionnelles) ──
  afterSubmit?: string;
  /** clé → `cleanValuesRegistry` ; ou {fn, params} pour une fn générique paramétrée (ex. dropEmptyArrayItems). */
  cleanValues?: FnRef;
}
