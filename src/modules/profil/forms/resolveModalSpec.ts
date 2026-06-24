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
import { configToDescriptor, formDescriptorToConfig, type FormDescriptor, type EntityLike } from "@/modules/formEngine";
import { buildConfigDefaults, buildPipelineDefaults, buildPipelinePayload } from "./jsonFormSubmit";
import type { EntityModalConfig } from "./EntityFormModal";
import type { ByMode, EntityModalCtx, EntityModalSpec } from "./entityModalSpec";
import type { EntityMutationSpec } from "../hooks/useEntityMutation";
import {
  getDescriptor, getDescriptorVariant, getDefaultsFn, getPayloadFn, getScopeFn, getSlot,
  getSchemaFn, getExistingUrlFn, getAfterSubmitFn, getCleanValuesFn, getInvalidateFn,
} from "./specRegistries";

type Values = Record<string, unknown>;
const KEEP_KEYS = (l: unknown) => (typeof l === "string" ? l : ((l as { fr?: string })?.fr ?? ""));

/** Résout une valeur `ByMode` selon le mode (string identique, ou {add,edit}). */
function pickMode<T>(v: ByMode<T>, mode: "add" | "edit"): T {
  return v && typeof v === "object" && "add" in (v as object) ? (v as { add: T; edit: T })[mode] : (v as T);
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

export function specToConfig(spec: EntityModalSpec): EntityModalConfig {
  /** Descripteur résolu pour un ctx (variante runtime éventuelle, sinon ref registre ou config embarquée). */
  const resolveDescriptor = (ctx: EntityModalCtx): FormDescriptor => {
    if (spec.descriptorVariant) {
      const fn = getDescriptorVariant(spec.descriptorVariant);
      if (fn) return fn(ctx);
    }
    if ("config" in spec.descriptor) return configToDescriptor(spec.descriptor.config, { tLoc: KEEP_KEYS });
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
            extraFields: m.inject?.extraFields,
            parent: m.inject?.parent ? (ctx.parent ?? null) : null,
            organizerFallback: m.inject?.organizerFallback ? (ctx.parent ?? null) : undefined,
          },
      navigateOnSuccess: m.navigateOnSuccess,
      successKey: pickMode(m.successKey, ctx.mode),
      errorKey: pickMode(m.errorKey, ctx.mode),
      errorContext: pickMode(m.errorContext, ctx.mode),
      invalidateQueries: m.invalidateFn ? (getInvalidateFn(m.invalidateFn)?.(ctx) ?? []) : [],
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
      if (ctx.mode === "edit" && ctx.entity) {
        const jsonConfig = formDescriptorToConfig(resolveDescriptor(ctx));
        return buildPipelineDefaults(jsonConfig, ctx.entity as unknown as EntityLike, { baseDefaults: () => base }) as FieldValues;
      }
      return base as FieldValues;
    },
    cleanValues: spec.cleanValues ? (v) => (getCleanValuesFn(spec.cleanValues!)?.(v) ?? v) as FieldValues : undefined,
    afterSubmit: spec.afterSubmit ? (ctx, v) => { getAfterSubmitFn(spec.afterSubmit!)?.(ctx, v); } : undefined,
    slots: spec.slots
      ? (ctx) => {
          const out: Record<string, ReactNode> = {};
          for (const [id, key] of Object.entries(spec.slots!)) out[id] = getSlot(key)?.(ctx) ?? null;
          return out;
        }
      : undefined,
    buildSpec,
  };
}
