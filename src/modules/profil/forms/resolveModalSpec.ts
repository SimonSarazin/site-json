/**
 * `specToConfig(spec)` — COMPILE une `EntityModalSpec` (données + clés) en `EntityModalConfig` (closures
 * dispatchant vers les registres). C'est le résolveur : il rend la spec exécutable SANS toucher à
 * `EntityFormModal` (qui consomme toujours un `EntityModalConfig`). Les défauts génériques (pipeline) sont
 * appliqués ici quand une clé est absente.
 *
 * Conséquence : une spec ne porte que des données + clés string (sérialisable / JSON-able), et c'est ce
 * résolveur — pas la modale — qui résout descripteur/defaults/scope/payload/slots depuis les registres.
 * cf. plan `~/.claude/plans/streamed-snuggling-glacier.md`.
 */
import type { ReactNode } from "react";
import type { FieldValues } from "react-hook-form";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { configToDescriptor, formDescriptorToConfig, type FormDescriptor, type EntityLike, type I18n } from "@/modules/formEngine";
import { buildConfigDefaults, buildPipelineDefaults, buildPipelinePayload } from "./jsonFormSubmit";
import type { EntityModalConfig } from "./EntityFormModal";
import type { ByMode, EntityModalCtx, EntityModalSpec } from "./entityModalSpec";
import type { EntityMutationSpec } from "../hooks/useEntityMutation";
import {
  getDescriptor, getDescriptorVariantFn, getDefaultsFn, getPayloadFn, getScopeFn, getSlotFn,
  getSchemaFn, getExistingUrlFn, getAfterSubmitFn, getCleanValuesFn, getInvalidateFn,
} from "./specRegistries";

type Values = Record<string, unknown>;
// Préserve le LocalizedString inline (résolu locale-aware au rendu par useT) ; clé string passée telle quelle. Cf. EntityFormModal.
const PRESERVE_LABELS = (l: I18n): I18n => l;

/** Résout une valeur `ByMode` selon le mode (string identique, ou {add,edit}). */
function pickMode<T>(v: ByMode<T>, mode: "add" | "edit"): T {
  return v && typeof v === "object" && "add" in (v as object) ? (v as { add: T; edit: T })[mode] : (v as T);
}

/** STAMP create : valeurs fixes (`extraFields`) + valeurs tirées du scope résolu (`extraFieldsFromScope`). */
function resolveExtraFields(inject: EntityModalSpec["mutation"]["inject"], scope: unknown): Record<string, unknown> | undefined {
  if (!inject?.extraFields && !inject?.extraFieldsFromScope) return undefined;
  const out: Record<string, unknown> = { ...(inject.extraFields ?? {}) };
  const sc = scope as Record<string, unknown> | undefined;
  for (const [field, key] of Object.entries(inject.extraFieldsFromScope ?? {})) out[field] = sc?.[key];
  return out;
}

/** Slug costum de CRÉATION : depuis le carrier, le scope dérivé (slugKey), ou une constante. */
function resolveCostumSlug(scope: EntityModalSpec["scope"], ctx: EntityModalCtx): string | undefined {
  if (!scope) return undefined;
  if (scope.slugFrom === "constant") return scope.constant;
  if (scope.slugFrom === "carrier") {
    const slug = (ctx.carrier?.serverData as { slug?: unknown } | undefined)?.slug ?? ctx.carrier?.slug;
    return typeof slug === "string" ? slug : undefined;
  }
  if (scope.slugFrom === "derived") {
    const v = (ctx.scope as Record<string, unknown> | undefined)?.[scope.slugKey ?? "sourceKey"];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

/**
 * Seed des champs GALERIE (widget "gallery") en ÉDITION : les `renderOnly` sont ignorés par le pipeline
 * de defaults → on injecte `existing` depuis `entity.getGalleryImages(contentKey)` (champ `images` fusionné
 * par about, chantier 2 backend). Valeur = GalleryValue, reconnue par le widget ET l'orchestration.
 */
function seedGalleryDefaults(defaults: FieldValues, jsonConfig: unknown, entity: unknown): void {
  const fields = (jsonConfig as { fields?: Record<string, { widget?: string; widgetProps?: Record<string, unknown> }> }).fields;
  if (!fields) return;
  const ent = (entity ?? {}) as {
    getGalleryImages?: (ck: string) => Array<Record<string, unknown>>;
    data?: { files?: unknown };
  };
  for (const [name, cfg] of Object.entries(fields)) {
    if (cfg?.widget === "gallery") {
      const contentKey = (cfg.widgetProps?.contentKey as string) ?? "slider";
      const docType = (cfg.widgetProps?.docType as string) ?? "image";
      // CREATE (pas d'entité) → `existing` vide ; EDIT → depuis about.images. Dans TOUS les cas on pose la
      // FORME complète {existing,added,removedDocIds,contentKey,docType} : sinon le default "" laisse le widget
      // produire une valeur sans `contentKey`/`removedDocIds` (`{...""}` = `{}`) → `isGalleryFieldValue` faux
      // → `processGalleryFields` saute le champ → AUCUN upload à la création.
      const existing = (typeof ent.getGalleryImages === "function" ? (ent.getGalleryImages(contentKey) ?? []) : [])
        .map((im) => ({ docId: String(im.id ?? ""), url: String(im.imagePath ?? im.imageMediumPath ?? "") }))
        .filter((e) => e.docId);
      (defaults as Record<string, unknown>)[name] = { existing, added: [], removedDocIds: [], contentKey, docType };
    } else if (cfg?.widget === "file") {
      // Widget FICHIER : `existing` lu SYNC depuis about.files (objet keyé _id, présent pour poi/
      // classifieds/projects ; buildDefaults est sync donc pas de getGalleryFiles async ici). Pour les
      // types sans about.files (org/citoyen/event), `existing` reste vide → ajout seul dans le form
      // (l'affichage/suppression des fichiers existants passe par la section profil / la vue article).
      const contentKey = (cfg.widgetProps?.contentKey as string) ?? "file";
      const filesObj = ent.data?.files;
      const raw = filesObj && typeof filesObj === "object" && !Array.isArray(filesObj)
        ? Object.values(filesObj as Record<string, Record<string, unknown>>)
        : Array.isArray(filesObj) ? (filesObj as Array<Record<string, unknown>>) : [];
      const existing = raw
        .map((f) => {
          const _id = f._id as { $id?: string } | string | undefined;
          const docId = _id && typeof _id === "object" ? _id.$id : _id;
          return { docId: String(docId ?? f.id ?? ""), url: String(f.docPath ?? ""), name: String(f.name ?? "") };
        })
        .filter((e) => e.docId);
      (defaults as Record<string, unknown>)[name] = { existing, added: [], removedDocIds: [], contentKey, docType: "file" };
    }
  }
}

export function specToConfig(spec: EntityModalSpec): EntityModalConfig {
  /** Descripteur résolu pour un ctx (variante runtime éventuelle, sinon ref registre ou config embarquée). */
  const resolveDescriptor = (ctx: EntityModalCtx): FormDescriptor => {
    if (spec.descriptorVariant) {
      const fn = getDescriptorVariantFn(spec.descriptorVariant);
      if (fn) return fn(ctx);
    }
    if ("config" in spec.descriptor) return configToDescriptor(spec.descriptor.config, { tLoc: PRESERVE_LABELS });
    return getDescriptor(spec.descriptor.ref) as FormDescriptor;
  };

  /** Socle de defaults : fn enregistrée (scope/structuré) OU dérivé du descripteur (`buildConfigDefaults`). */
  const baseDefaults = (ctx: EntityModalCtx): Values => {
    if (spec.defaults?.base) {
      const fn = getDefaultsFn(spec.defaults.base);
      if (fn) return fn(ctx);
    }
    return buildConfigDefaults(formDescriptorToConfig(resolveDescriptor(ctx)));
  };

  /** Construit l'`EntityMutationSpec` runtime depuis les DONNÉES `spec.mutation` + clés résolues. */
  const buildSpec = (ctx: EntityModalCtx): EntityMutationSpec => {
    const m = spec.mutation;
    const jsonConfig = formDescriptorToConfig(resolveDescriptor(ctx));
    const payloadFn = m.payloadFn ? getPayloadFn(m.payloadFn) : undefined;
    const buildPayload = (form: Values): Values =>
      payloadFn
        ? payloadFn(form, ctx)
        : buildPipelinePayload(jsonConfig, form, { emitEmpty: ctx.mode === "edit" && (m.payloadEmitEmptyOnEdit ?? false) });
    const isEdit = ctx.mode === "edit";
    return {
      mode: ctx.mode,
      entityType: m.entityType,
      target: isEdit ? (ctx.entity ?? null) : (ctx.parent ?? null),
      buildPayload,
      costumSlug: isEdit ? undefined : resolveCostumSlug(spec.scope, ctx),
      imageField: spec.image?.field,
      inject: isEdit
        ? undefined
        : {
            role: m.inject?.role,
            dropEmptyEmail: m.inject?.dropEmptyEmail,
            extraFields: resolveExtraFields(m.inject, ctx.scope),
            parent: m.inject?.parent ? (ctx.parent ?? null) : null,
            organizerFallback: m.inject?.organizerFallback ? (ctx.parent ?? null) : undefined,
          },
      navigateOnSuccess: m.navigateOnSuccess,
      successKey: pickMode(m.successKey, ctx.mode),
      errorKey: pickMode(m.errorKey, ctx.mode),
      errorContext: pickMode(m.errorContext, ctx.mode),
      invalidateQueries: m.invalidateFn
        ? (getInvalidateFn(typeof m.invalidateFn === "string" ? m.invalidateFn : m.invalidateFn.fn)?.(
            ctx, typeof m.invalidateFn === "string" ? undefined : m.invalidateFn.params) ?? [])
        : [],
    };
  };

  return {
    descriptor: (ctx) => resolveDescriptor(ctx),
    title: spec.title,
    description: spec.description,
    submitLabel: spec.submitLabel,
    icon: spec.icon,
    gradientHeader: spec.gradientHeader,
    dialogClassName: spec.dialogClassName,
    validationFailedKey: spec.validationFailedKey,
    listsFromCarrier: spec.listsFromCarrier,
    imageField: spec.image?.field,
    imageExistingUrl: spec.image?.existingUrlFrom
      ? (entity: EntityTypes) => getExistingUrlFn(spec.image!.existingUrlFrom!)?.(entity)
      : undefined,
    resolveScope: spec.scope?.derive
      ? (carrier) => getScopeFn(spec.scope!.derive!)?.(carrier, spec.scope!.defaults)
      : undefined,
    texts: spec.navText
      ? (t) => ({
          next: spec.navText!.next ? t(spec.navText!.next) : "",
          previous: spec.navText!.previous ? t(spec.navText!.previous) : "",
          cancel: t(spec.navText!.cancel ?? "common.cancel"),
          stepLabel: spec.navText!.stepLabelKey
            ? (index, total) => t(spec.navText!.stepLabelKey!, undefined, { index, total }) as string
            : spec.navText!.stepTemplate
              ? (index, total) => `${t(spec.navText!.stepTemplate!.stepKey)} ${index} ${t(spec.navText!.stepTemplate!.ofKey)} ${total}`
              : undefined,
        })
      : undefined,
    getSchema: spec.schemaFn ? (ctx) => getSchemaFn(spec.schemaFn!)!(ctx) : undefined,
    buildDefaults: (ctx) => {
      const base = baseDefaults(ctx);
      const jsonConfig = formDescriptorToConfig(resolveDescriptor(ctx));
      if (ctx.mode === "edit" && ctx.entity) {
        const defaults = buildPipelineDefaults(jsonConfig, ctx.entity as unknown as EntityLike, { baseDefaults: () => base }) as FieldValues;
        // Seed des champs GALERIE (widget "gallery", renderOnly → ignorés par le pipeline) : `existing`
        // depuis entity.getGalleryImages(contentKey) (champ `images` fusionné par about, chantier 2 backend).
        seedGalleryDefaults(defaults, jsonConfig, ctx.entity);
        return defaults;
      }
      // CREATE : seeder AUSSI la forme vide des champs galerie/fichier (sinon le default "" empêche le widget
      // de produire une valeur `isGalleryFieldValue` → upload sauté à la création). `entity=null` → existing vide.
      seedGalleryDefaults(base as FieldValues, jsonConfig, null);
      return base as FieldValues;
    },
    cleanValues: spec.cleanValues ? (v) => {
      const cv = spec.cleanValues!;
      const fn = typeof cv === "string" ? cv : cv.fn;
      const params = typeof cv === "string" ? undefined : cv.params;
      return (getCleanValuesFn(fn)?.(v, params) ?? v) as FieldValues;
    } : undefined,
    afterSubmit: spec.afterSubmit ? (ctx, v) => { getAfterSubmitFn(spec.afterSubmit!)?.(ctx, v); } : undefined,
    slots: spec.slots
      ? (ctx) => {
          const out: Record<string, ReactNode> = {};
          for (const [id, key] of Object.entries(spec.slots!)) out[id] = getSlotFn(key)?.(ctx) ?? null;
          return out;
        }
      : undefined,
    buildSpec,
  };
}
