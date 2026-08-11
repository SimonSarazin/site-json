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

/**
 * Valeur d'un stamp — littéral (≡ $const), ou UNE source calculée :
 *  - `{"$now": "j/M/aaaa"}` : horodatage à la SOUMISSION, jetons `j jj M MM aaaa` SANS padding par
 *    défaut (byte-parité avec le stamp legacy `${getDate()}/${getMonth()+1}/${getFullYear()}`) ;
 *  - `{"$from": "<champ>"}` : la valeur d'un autre champ du PAYLOAD (après pipeline — un stamp
 *    précédent de la liste est visible du suivant) ;
 *  - `{"$scope": "<clé>"}` : la valeur du scope résolu (scopeFn) — résolue EAGER dans `buildSpec`,
 *    même mécanique que `inject.extraFieldsFromScope` ;
 *  - `{"$costum": "<clé>"}` : la valeur du bloc `config.costum` du site (mainTag/compagnon…,
 *    par DÉPLOIEMENT) — résolue EAGER elle aussi.
 */
/**
 *  - `{"$mapLabels": {from, map, sep?}}` : lit le champ `from` du payload (chaîne ou tableau de
 *    slugs ; si chaîne et `sep` fourni, découpe), mappe chaque slug via `map` (slug→libellé),
 *    ignore les slugs absents du map → tableau de LIBELLÉS. Sert le patron tiers-lieux : les
 *    facettes du search filtrent `tags` sur les libellés, mais le form stocke des slugs (typePlace/
 *    manageModel) — on recopie donc les libellés dans `tags` (op:append).
 *  - `{"$bucket": {from, buckets}}` : lit le NOMBRE `from` du payload et rend le `label` du premier
 *    bucket dont `lt` n'est pas dépassé (bucket sans `lt` = défaut/dernier). Sert la tranche m²
 *    dérivée de `buildingSurfaceArea` (port CLIENT du `ReseauTierslieux::elementAfterSave` legacy).
 */
export type StampBucket = { lt?: number; label: string };
export type StampValue =
  | unknown
  | { $now: string }
  | { $from: string }
  | { $scope: string }
  | { $costum: string }
  | { $mapLabels: { from: string; map: Record<string, string>; sep?: string } }
  | { $bucket: { from: string; buckets: StampBucket[] } };

/**
 * Un STAMP : valeur calculée posée déclarativement par la mutation — le remplaçant configurable
 * des effets codés en dur (merge tags de tl:payload, extraFieldsFromScope, afterSave legacy…).
 *
 * ⚠ Canal `payload` : le champ doit appartenir au SCHÉMA D'ÉCRITURE de la lib (contrat de base ou
 * schéma costum), sinon la couche `_extractWritableFields` le DROPPE en silence — c'est précisément
 * pour ces champs-là que le canal `pathValue` existe (écriture post-save via `entity.updateField`,
 * le patron du afterSave legacy). `pathValue` est réservé à l'entité PROPRE (créée/éditée par
 * l'utilisateur) — jamais une écriture d'autorité sur entité étrangère (cf. useReferenceElement :
 * setsource/validategroup/allowance).
 */
export interface SpecStamp {
  /** Champ cible (canal payload : clé du payload ; canal pathValue : chemin Mongo pointé). */
  field: string;
  value: StampValue;
  /** `set` (défaut, écrase) | `fillIfEmpty` (seulement si vide : undefined/null/""/[]) |
   *  `append` (union dédupliquée sur tableau ; en EDIT fusionne aussi la valeur serveur existante). */
  op?: "set" | "fillIfEmpty" | "append";
  /** Phase : `add` (défaut) | `edit` | `both`. */
  on?: "add" | "edit" | "both";
  /** `payload` (défaut : fusion dans le payload d'envoi) | `pathValue` (post-save, échec NON
   *  bloquant — la fragilité du patron legacy afterSave est assumée et loggée). */
  channel?: "payload" | "pathValue";
}

/** Bloc WRITE : DONNÉES + clé `payloadFn` (défaut = pipeline) + clé `invalidateFn`. */
export interface SpecMutation {
  entityType: EntityKind;
  /** clé → `payloadRegistry` ; ABSENT → pipeline générique (`buildPipelinePayload`). */
  payloadFn?: string;
  /** édition via pipeline : émettre les vides typés (`buildEditPayload`). Défaut false (création). */
  payloadEmitEmptyOnEdit?: boolean;
  inject?: SpecInject;
  /** Stamps déclaratifs (valeurs calculées, add ET/OU edit) — cf. {@link SpecStamp}. Évalués dans
   *  l'ordre de la liste. Champ PROPRE (pas sous `inject`, qui est strippé en édition). */
  stamps?: SpecStamp[];
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
