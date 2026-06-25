/**
 * Registres du code IRRÉDUCTIBLE référencé PAR CLÉ depuis une `EntityModalSpec` (cf. `entityModalSpec.ts`).
 * Même pattern que `formEngine/engine/transforms.ts` (Map + register/get + warn si clé absente), mais côté
 * PROFIL : ces fns dépendent du domaine (SDK/pipeline/React/zod) — elles ne peuvent pas vivre dans le leaf
 * formEngine. Une spec ne porte que des CLÉS string ; le code (impur) est enregistré par side-effect depuis
 * chaque `forms/costum/<entity>/fns.ts` (agrégés par `registerSpecFns.ts`).
 *
 * Les registres à DÉFAUT GÉNÉRIQUE (payload/defaults/scope/schema/afterSubmit/cleanValues) sont appliqués par
 * le résolveur quand la clé est absente — donc rarement renseignés (le pipeline suffit). `descriptor` et
 * `slot` n'ont pas de défaut.
 */
import type { ReactNode } from "react";
import type { z } from "zod";
import type { QueryKey } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { FormDescriptor } from "@/modules/formEngine";
import type { EntityModalCtx } from "./entityModalSpec";

type Values = Record<string, unknown>;

function warnMissing(kind: string, key: string): void {
  console.warn(`[entityModalSpec] ${kind} "${key}" introuvable. Le module qui l'enregistre (forms/registerSpecFns) est-il importé ?`);
}

// ── Descripteurs (par FormDescriptor.id) ──────────────────────────────────────
const descriptors = new Map<string, FormDescriptor>();
export function registerDescriptor(descriptor: FormDescriptor): void {
  descriptors.set(descriptor.id, descriptor);
}
export function getDescriptor(id: string): FormDescriptor | undefined {
  const d = descriptors.get(id);
  if (!d) warnMissing("descriptor", id);
  return d;
}

// ── Variante de descripteur runtime (event hasParent / edit-profil byType) ────
export type DescriptorVariantFn = (ctx: EntityModalCtx) => FormDescriptor;
const descriptorVariants = new Map<string, DescriptorVariantFn>();
export function registerDescriptorVariant(key: string, fn: DescriptorVariantFn): void {
  descriptorVariants.set(key, fn);
}
export function getDescriptorVariant(key: string): DescriptorVariantFn | undefined {
  const fn = descriptorVariants.get(key);
  if (!fn) warnMissing("descriptorVariant", key);
  return fn;
}

// ── Defaults : socle structuré/scope-aware (ctx → valeurs) ────────────────────
export type DefaultsFn = (ctx: EntityModalCtx) => Values;
const defaultsFns = new Map<string, DefaultsFn>();
export function registerDefaultsFn(key: string, fn: DefaultsFn): void {
  defaultsFns.set(key, fn);
}
export function getDefaultsFn(key: string): DefaultsFn | undefined {
  const fn = defaultsFns.get(key);
  if (!fn) warnMissing("defaultsFn", key);
  return fn;
}

// ── Payload de création/édition (form, ctx → payload) ─────────────────────────
export type PayloadFn = (formData: Values, ctx: EntityModalCtx) => Values;
const payloadFns = new Map<string, PayloadFn>();
export function registerPayloadFn(key: string, fn: PayloadFn): void {
  payloadFns.set(key, fn);
}
export function getPayloadFn(key: string): PayloadFn | undefined {
  const fn = payloadFns.get(key);
  if (!fn) warnMissing("payloadFn", key);
  return fn;
}

// ── Scope costum (carrier + defaults de config → scope) ───────────────────────
export type ScopeFn = (carrier: EntityTypes | null | undefined, defaults?: Record<string, unknown>) => unknown;
const scopeFns = new Map<string, ScopeFn>();
export function registerScopeFn(key: string, fn: ScopeFn): void {
  scopeFns.set(key, fn);
}
export function getScopeFn(key: string): ScopeFn | undefined {
  const fn = scopeFns.get(key);
  if (!fn) warnMissing("scopeFn", key);
  return fn;
}

// ── Slots UI (id → composant, reçoit le ctx) ──────────────────────────────────
export type SlotFn = (ctx: EntityModalCtx) => ReactNode;
const slotFns = new Map<string, SlotFn>();
export function registerSlot(id: string, fn: SlotFn): void {
  slotFns.set(id, fn);
}
export function getSlot(id: string): SlotFn | undefined {
  const fn = slotFns.get(id);
  if (!fn) warnMissing("slot", id);
  return fn;
}

// ── Schéma zod externe (ctx → zod) ────────────────────────────────────────────
export type SchemaFn = (ctx: EntityModalCtx) => z.ZodTypeAny;
const schemaFns = new Map<string, SchemaFn>();
export function registerSchemaFn(key: string, fn: SchemaFn): void {
  schemaFns.set(key, fn);
}
export function getSchemaFn(key: string): SchemaFn | undefined {
  const fn = schemaFns.get(key);
  if (!fn) warnMissing("schemaFn", key);
  return fn;
}

// ── URL d'image existante (entity → url) ──────────────────────────────────────
export type ExistingUrlFn = (entity: EntityTypes) => string | undefined;
const existingUrlFns = new Map<string, ExistingUrlFn>();
export function registerExistingUrlFn(key: string, fn: ExistingUrlFn): void {
  existingUrlFns.set(key, fn);
}
export function getExistingUrlFn(key: string): ExistingUrlFn | undefined {
  const fn = existingUrlFns.get(key);
  if (!fn) warnMissing("existingUrlFn", key);
  return fn;
}

// ── afterSubmit (ctx, values → void) ──────────────────────────────────────────
export type AfterSubmitFn = (ctx: EntityModalCtx, values: Values) => void;
const afterSubmitFns = new Map<string, AfterSubmitFn>();
export function registerAfterSubmitFn(key: string, fn: AfterSubmitFn): void {
  afterSubmitFns.set(key, fn);
}
export function getAfterSubmitFn(key: string): AfterSubmitFn | undefined {
  const fn = afterSubmitFns.get(key);
  if (!fn) warnMissing("afterSubmitFn", key);
  return fn;
}

// ── cleanValues (values, params? → values) ────────────────────────────────────
export type CleanValuesFn = (values: Values, params?: Record<string, unknown>) => Values;
const cleanValuesFns = new Map<string, CleanValuesFn>();
export function registerCleanValuesFn(key: string, fn: CleanValuesFn): void {
  cleanValuesFns.set(key, fn);
}
export function getCleanValuesFn(key: string): CleanValuesFn | undefined {
  const fn = cleanValuesFns.get(key);
  if (!fn) warnMissing("cleanValuesFn", key);
  return fn;
}

// ── invalidateQueries (ctx, params? → QueryKey[]) ─────────────────────────────
export type InvalidateFn = (ctx: EntityModalCtx, params?: Record<string, unknown>) => QueryKey[];
const invalidateFns = new Map<string, InvalidateFn>();
export function registerInvalidateFn(key: string, fn: InvalidateFn): void {
  invalidateFns.set(key, fn);
}
export function getInvalidateFn(key: string): InvalidateFn | undefined {
  const fn = invalidateFns.get(key);
  if (!fn) warnMissing("invalidateFn", key);
  return fn;
}
