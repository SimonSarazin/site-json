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
import type { JsonFormConfig } from "@/modules/formEngine";
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
  /** valeurs fixes ajoutées au payload (preset costum). */
  extraFields?: Record<string, unknown>;
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
  successKey: string;
  errorKey: string;
  errorContext: string;
  /** clé → `invalidateRegistry` : (ctx) => QueryKey[]. */
  invalidateFn?: string;
}

/** Spec déclarative SÉRIALISABLE d'une modale d'entité. */
export interface EntityModalSpec {
  id: string;
  descriptor: DescriptorRef;
  /** clé → `descriptorVariantRegistry` (event hasParent / edit-profil byType) ; sinon descripteur brut. */
  descriptorVariant?: string;

  // ── chrome (DONNÉES) ──
  title: { add: string; edit: string };
  description?: { add?: string; edit?: string };
  submitLabel?: { add: string; edit: string };
  icon?: string;
  gradientHeader?: boolean;
  dialogClassName?: string;
  validationFailedKey?: string;
  /** libellés de navigation wizard (clés i18n). `stepLabelKey` interpolé {index}/{total}. */
  navText?: { next?: string; previous?: string; cancel?: string; stepLabelKey?: string };

  // ── read ──
  /** `base` = clé → `defaultsRegistry` (socle structuré/scope-aware) ; absent → `buildConfigDefaults(config)`. */
  defaults?: { base?: string };

  // ── image ──
  image?: { field: string; existingUrlFrom?: string };

  // ── options runtime (selects) ──
  listsFromCarrier?: boolean;

  // ── scope costum ──
  scope?: { slugFrom?: "carrier" | "constant"; constant?: string; derive?: string };

  // ── slots (id de slot → clé registre) ──
  slots?: Record<string, string>;

  // ── validation externe (clé → `schemaRegistry`) ; sinon zod auto du descripteur ──
  schemaFn?: string;

  // ── write ──
  mutation: SpecMutation;

  // ── effets (clés optionnelles) ──
  afterSubmit?: string;
  cleanValues?: string;
}
