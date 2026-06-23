/**
 * API GÉNÉRIQUE de traitement d'un formulaire d'entité (architecture C-light, cf. doc/refactor-field-treatment.md).
 * UN `FormSpec` par entité (descripteur read+write unifié + overlays) ; 3 primitives PURES au-dessus du pipeline :
 *  - `seedEntity(spec, entity?)` : READ (création + édition) — socle + valeurs serveur seedées.
 *  - `buildPayload(spec, values)`: WRITE complet (omit-empty natif) — pour la CRÉATION.
 *  - `buildDelta(spec, values, baseline)` : ÉDITION — delta serveur (modifié + effacé typé) vs baseline.
 *
 * Remplace les wrappers ad hoc par entité (buildEditDefaults / mapEntityToTiersLieuxValues / buildTiersLieuxPayload /
 * buildEditDelta / buildProfileUpdateData) par UN seul jeu de fonctions. Ajouter une entité = écrire UN spec.
 */
import type { FormDescriptor, FormValues } from "../types";
import { seedFromEntity, valuesToPayload, diffForEdit } from "./fieldPipeline";

export interface FormSpec {
  /** Descripteur UNIQUE read+write (asymétries déclarées via path/group/writeOnly/readOnly/groupReadOnly). */
  descriptor: FormDescriptor;
  /** Socle typé : champs hors descripteur (logo/photos/…) + complétude du type form. À terme dérivable du descripteur. */
  baseDefaults?: () => FormValues;
  /** Clés exclues du diff d'édition (traitées à part : tags mergés, adresse atomique gérée par le groupe…). */
  diffSkip?: readonly string[];
}

export type EntityLike = { serverData?: Record<string, unknown> | null } | null | undefined;

/** READ (création + édition) : socle `baseDefaults` écrasé par les valeurs serveur seedées (path + read + défauts). */
export function seedEntity(spec: FormSpec, entity?: EntityLike): FormValues {
  return { ...(spec.baseDefaults?.() ?? {}), ...seedFromEntity(spec.descriptor, (entity?.serverData ?? {}) as FormValues) };
}

/** WRITE complet (CRÉATION) : valeurs de form → payload serveur. Un `write` renvoyant `undefined` sur vide → clé omise. */
export function buildPayload(spec: FormSpec, values: FormValues): FormValues {
  return valuesToPayload(spec.descriptor, values);
}

/**
 * ÉDITION (pattern unifié S6) : payload COMPLET, vides typés (`""`/`[]`). À `Object.assign` sur `entity.data`
 * puis `entity.save()` — le SDK diffe en interne (n'envoie que les champs réellement changés) et le backend
 * efface les vides (`$unset`). Remplace les diff/clear ad hoc côté site (reconcileClearedFields, buildEditDelta) :
 * prouvé par tests/integration/advanced/unified-save-clear.test.ts (5080↔5099, chemins costum & standard).
 */
export function buildEditPayload(spec: FormSpec, values: FormValues): FormValues {
  return valuesToPayload(spec.descriptor, values, { emitEmpty: true });
}

/**
 * ÉDITION : delta serveur (champs modifiés + EFFACÉS en clear typé) entre `values` et `baseline` (= seedEntity
 * de l'entité). Absorbe l'effacement nativement (champ vidé → clear `""`/`[]`, jamais `{}`). `diffSkip` exclut
 * les clés gérées à part. `baseline` = les valeurs seedées de l'entité (cf. seedEntity).
 */
export function buildDelta(spec: FormSpec, values: FormValues, baseline: FormValues): FormValues {
  return diffForEdit(spec.descriptor, buildPayload(spec, values), buildPayload(spec, baseline), { skip: spec.diffSkip });
}
