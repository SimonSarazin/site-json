/**
 * Génère un schéma Zod depuis un FormDescriptor (§7 du design).
 * - type de base par champ (lenient : tout `.optional()`), validation fine en `superRefine` ;
 * - `required` STATIQUE ou CONDITIONNEL (`requiredIf`) ;
 * - **champ caché (`visibleIf` faux) = NON validé** (règle d'or) ;
 * - règles : url / min / max / minLength / maxLength / regex (appliquées si valeur non vide) ;
 *   sur un TABLEAU, `min`/`max` portent sur le nombre d'éléments (`validation.minItems`/`maxItems`).
 * La validation d'appartenance enum / le contrôle métier fin restent au backend (gate atomique).
 */
import { z } from "zod";
import type { FieldDescriptor, FormDescriptor, FormValues } from "../types";
import { check, evaluatePredicate } from "./conditional";
import { resolveValidate } from "./transforms";

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Schéma de base lenient par type (tout optionnel ; le required est géré en refine). */
function baseFieldSchema(field: FieldDescriptor): z.ZodTypeAny {
  switch (field.type) {
    case "number":
      // "" / null → undefined (sinon coerce → NaN). Accepte number ou string numérique.
      return z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().optional());
    case "boolean":
      return z.boolean().optional();
    case "array":
      return z.array(z.any()).optional();
    case "object":
    case "date":
    default:
      return z.any().optional();
  }
}

export function buildZodSchema(descriptor: FormDescriptor) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, field] of Object.entries(descriptor.fields)) {
    shape[name] = baseFieldSchema(field);
  }
  // validate : fonction inline OU clé de registre (config-driven), résolue une fois.
  const validate = resolveValidate(descriptor.validate);

  return z.object(shape).passthrough().superRefine((values, ctx) => {
    const v = values as FormValues;
    for (const [name, field] of Object.entries(descriptor.fields)) {
      // champ caché → on ne valide rien
      if (!check(field.visibleIf, v)) continue;

      const value = v[name];
      // Message d'une règle : custom (config LocalizedString pré-résolu) sinon clé i18n par défaut.
      const m = field.messages;
      const required =
        field.required === true ||
        (field.requiredIf ? evaluatePredicate(field.requiredIf, v) : false);

      if (required && isEmpty(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: m?.required ?? "validation.required" });
        continue;
      }
      if (isEmpty(value)) continue; // pas de règle sur un champ vide non requis

      const r = field.rules;
      if (!r) continue;
      if (r.url && typeof value === "string" && !/^https?:\/\/\S+$/i.test(value))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: m?.url ?? "validation.url.invalid" });
      if (r.minLength != null && typeof value === "string" && value.length < r.minLength)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: m?.minLength ?? "validation.minLength" });
      if (r.maxLength != null && typeof value === "string" && value.length > r.maxLength)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: m?.maxLength ?? "validation.maxLength" });
      // `min`/`max` sur un TABLEAU portent sur le NOMBRE d'éléments (ex. « 2 catégories maximum »
      // du select2 legacy `maximumSelectionLength`) — pas sur `Number(value)`, qui vaudrait NaN.
      if (Array.isArray(value)) {
        if (r.min != null && value.length < r.min)
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: m?.min ?? "validation.minItems" });
        if (r.max != null && value.length > r.max)
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: m?.max ?? "validation.maxItems" });
      } else {
        if (r.min != null && Number(value) < r.min)
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: m?.min ?? "validation.min" });
        if (r.max != null && Number(value) > r.max)
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: m?.max ?? "validation.max" });
      }
      if (r.regex && typeof value === "string" && !new RegExp(r.regex).test(value))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: m?.format ?? "validation.format" });
    }
    // Validation CROSS-CHAMP du descripteur (ex. addressValid : adresse sans localityId).
    for (const issue of validate?.(v) ?? []) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.path], message: issue.message });
    }
  });
}
