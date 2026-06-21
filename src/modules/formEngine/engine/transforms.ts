/**
 * Registre de transformers NOMMÉS (§6 du design) — remplace l'`eval`-string du legacy par des
 * fonctions TS enregistrées. Trois usages, même registre :
 *  - `read`     : valeur serveur → valeur de form (pré-remplissage)
 *  - `write`    : valeur de form → valeur de payload
 *  - `computed` : (valeurs des deps) → valeur dérivée (ex. surface = long × larg)
 *
 * Les transformers GÉNÉRIQUES vivent ici (formEngine). Les transformers MÉTIER (ex. family↔typePlace
 * d'un tiers-lieu) s'enregistrent depuis le module domaine (profil) via `registerTransform`.
 */
import type { FormValues } from "../types";

/** read/write : (value, allValues) → value. computed : reçoit allValues (deps lues par l'appelant). */
export type TransformFn = (value: unknown, all: FormValues) => unknown;

const registry = new Map<string, TransformFn>();

export function registerTransform(name: string, fn: TransformFn): void {
  registry.set(name, fn);
}
export function getTransform(name: string): TransformFn | undefined {
  return registry.get(name);
}
/** Applique un transformer nommé (identité si inconnu — mais on PRÉVIENT, une clé fautive = silencieuse). */
export function applyTransform(name: string | undefined, value: unknown, all: FormValues): unknown {
  if (!name) return value;
  const fn = registry.get(name);
  if (!fn) {
    console.warn(`[formEngine] transform "${name}" introuvable (valeur inchangée). Module d'enregistrement importé ?`);
    return value;
  }
  return fn(value, all);
}

// ── Transformers génériques de base ──────────────────────────────────────────
const toNumber: TransformFn = (v) => (v === "" || v == null ? undefined : Number(v));
const toString: TransformFn = (v) => (v == null ? "" : String(v));
const toBoolean: TransformFn = (v) => v === true || v === "true" || v === 1 || v === "1";
const toStringArray: TransformFn = (v) => (Array.isArray(v) ? v.map(String) : v == null || v === "" ? [] : [String(v)]);
const splitCsv: TransformFn = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v);
const joinCsv: TransformFn = (v) => (Array.isArray(v) ? v.join(", ") : v);

registry.set("identity", (v) => v);
registry.set("toNumber", toNumber);
registry.set("toString", toString);
registry.set("toBoolean", toBoolean);
registry.set("toStringArray", toStringArray);
registry.set("splitCsv", splitCsv);
registry.set("joinCsv", joinCsv);

// ── Validators CROSS-CHAMP nommés (FormDescriptor.validate string / config.validateFn) ──────
export type ValidateFn = (values: FormValues) => Array<{ path: string; message: string }>;
const validateRegistry = new Map<string, ValidateFn>();
export function registerValidate(name: string, fn: ValidateFn): void {
  validateRegistry.set(name, fn);
}
export function getValidate(name: string): ValidateFn | undefined {
  return validateRegistry.get(name);
}
/** Résout le `validate` d'un descripteur : fonction inline (rendue telle quelle) OU clé de registre.
 *  PRÉVIENT si une clé string est absente du registre (sinon la validation cross-champ disparaît en silence). */
export function resolveValidate(validate: string | ValidateFn | undefined): ValidateFn | undefined {
  if (!validate) return undefined;
  if (typeof validate !== "string") return validate;
  const fn = validateRegistry.get(validate);
  if (!fn) {
    console.warn(`[formEngine] validate "${validate}" introuvable dans validateRegistry — validation cross-champ IGNORÉE. Le module qui l'enregistre (ex. forms/validators) est-il importé ?`);
  }
  return fn;
}

// ── Transformers COMPUTED : (valeurs des deps) → valeur dérivée (field.computedFrom) ──────────
export type ComputeFn = (deps: unknown[]) => unknown;
const computeRegistry = new Map<string, ComputeFn>();
export function registerCompute(name: string, fn: ComputeFn): void {
  computeRegistry.set(name, fn);
}
export function getCompute(name: string): ComputeFn | undefined {
  return computeRegistry.get(name);
}
/** Produit le produit des deps si TOUTES sont des nombres finis, sinon undefined (ex. surface = long × larg). */
computeRegistry.set("multiply", (deps) =>
  deps.every((d) => typeof d === "number" && Number.isFinite(d))
    ? (deps as number[]).reduce((a, b) => a * b, 1)
    : undefined,
);
