/**
 * Évaluation d'un `Predicate` sur les valeurs courantes du formulaire (§3 du design).
 * Pur + synchrone → testable et utilisable réactivement (RHF `watch`).
 */
import type { Predicate, PredicateOp, FormValues } from "../types";

/** « vide » au sens formulaire : null/undefined/""/[] (mais 0 et false ne sont PAS vides). */
function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function compare(op: PredicateOp, actual: unknown, expected: unknown): boolean {
  switch (op) {
    case "eq": return actual === expected;
    case "ne": return actual !== expected;
    case "in": return Array.isArray(expected) && expected.includes(actual);
    case "nin": return Array.isArray(expected) && !expected.includes(actual);
    case "gt": return Number(actual) > Number(expected);
    case "gte": return Number(actual) >= Number(expected);
    case "lt": return Number(actual) < Number(expected);
    case "lte": return Number(actual) <= Number(expected);
    case "truthy": return Boolean(actual) && !isEmpty(actual);
    case "falsy": return !actual || isEmpty(actual);
    case "empty": return isEmpty(actual);
    case "notEmpty": return !isEmpty(actual);
    case "matches": return typeof actual === "string" && typeof expected === "string" && new RegExp(expected).test(actual);
    // `contains` : la valeur courante (tableau multi-select OU string) inclut `expected`.
    case "contains": return Array.isArray(actual) ? actual.includes(expected) : (typeof actual === "string" && typeof expected === "string" && actual.includes(expected));
    default: return false;
  }
}

/** Évalue un prédicat. `undefined` (pas de condition) → toujours vrai (côté appelant). */
export function evaluatePredicate(pred: Predicate, values: FormValues): boolean {
  if ("and" in pred) return pred.and.every((p) => evaluatePredicate(p, values));
  if ("or" in pred) return pred.or.some((p) => evaluatePredicate(p, values));
  if ("not" in pred) return !evaluatePredicate(pred.not, values);
  return compare(pred.op, values[pred.field], pred.value);
}

/** Helper : condition optionnelle (absente = vrai). */
export function check(pred: Predicate | undefined, values: FormValues): boolean {
  return pred === undefined ? true : evaluatePredicate(pred, values);
}
