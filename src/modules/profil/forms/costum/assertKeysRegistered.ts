/**
 * Garde du loader costum : vérifie que TOUTES les clés de registre référencées par un costum compilé
 * (descripteur + spec) sont effectivement ENREGISTRÉES, et lève une erreur CLAIRE sinon — au lieu du
 * `console.warn` silencieux au rendu (transform inchangé / validation ignorée / options vides).
 *
 * Appelée par `registerCostumForm` (voie config). Suppose que les clés génériques sont déjà chargées
 * (cf. `sharedRegistrations`, importé par le loader) ; une clé MÉTIER inédite non enregistrée signale qu'il
 * faut un `forms/costum/<id>/fns.ts` (et son ajout au barrel `registerSpecFns`).
 */
import type { FormDescriptor } from "@/modules/formEngine";
import { hasRegistered } from "@/modules/formEngine/engine/transforms";
import type { EntityModalSpec, FnRef } from "../entityModalSpec";
import { hasSpecFn, type SpecFnKind } from "../specRegistries";

/** Clé d'un `FnRef` (string seule, ou { fn, params }). */
function fnRefKey(ref: FnRef | undefined): string | undefined {
  if (ref == null) return undefined;
  return typeof ref === "string" ? ref : ref.fn;
}

/**
 * Lève si une clé citée par le descripteur ou la spec n'est pas enregistrée. Vérifie :
 *  - descripteur : `read`/`write` des champs, `enumFrom` (options), `computedFrom.fn` (compute),
 *    `read`/`write` des `serializeGroups`, `validate` (clé string) ;
 *  - spec : `descriptorVariant`, `defaults.base`, `image.existingUrlFrom`, `scope.derive`, `slots`,
 *    `schemaFn`, `mutation.payloadFn`, `mutation.invalidateFn`, `afterSubmit`, `cleanValues`.
 */
export function assertCostumKeysRegistered(descriptor: FormDescriptor, spec: EntityModalSpec): void {
  const missing: Array<{ kind: string; key: string }> = [];

  type TxKind = "transform" | "validate" | "options" | "compute";
  const tx = (kind: TxKind, key: string | undefined) => {
    if (key && !hasRegistered(kind, key)) missing.push({ kind, key });
  };
  const sf = (kind: SpecFnKind, key: string | undefined) => {
    if (key && !hasSpecFn(kind, key)) missing.push({ kind, key });
  };

  // ── descripteur ──
  for (const field of Object.values(descriptor.fields)) {
    tx("transform", field.read);
    tx("transform", field.write);
    tx("options", field.enumFrom);
    tx("compute", field.computedFrom?.fn);
  }
  for (const g of Object.values(descriptor.serializeGroups ?? {})) {
    tx("transform", g.read);
    tx("transform", g.write);
  }
  if (typeof descriptor.validate === "string") tx("validate", descriptor.validate);

  // ── spec ──
  sf("descriptorVariant", spec.descriptorVariant);
  sf("defaultsFn", spec.defaults?.base);
  sf("existingUrlFn", spec.image?.existingUrlFrom);
  sf("scopeFn", spec.scope?.derive);
  for (const slotKey of Object.values(spec.slots ?? {})) sf("slot", slotKey);
  sf("schemaFn", spec.schemaFn);
  sf("payloadFn", spec.mutation.payloadFn);
  sf("invalidateFn", fnRefKey(spec.mutation.invalidateFn));
  sf("afterSubmitFn", spec.afterSubmit);
  sf("cleanValuesFn", fnRefKey(spec.cleanValues));

  if (missing.length > 0) {
    const list = missing.map((m) => `${m.kind}:"${m.key}"`).join(", ");
    throw new Error(
      `[costumForms] costum "${spec.id}" référence des clés NON ENREGISTRÉES : ${list}. ` +
        `Importe le module qui les enregistre (clés génériques via forms/costum/sharedRegistrations, ` +
        `ou une clé métier via forms/costum/${spec.id}/fns.ts ajouté à forms/registerSpecFns).`,
    );
  }
}
