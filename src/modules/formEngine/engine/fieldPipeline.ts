/**
 * Pipeline de TRAITEMENT DES CHAMPS unifié (cf. doc/refactor-field-treatment.md, P1) — PUR, additif.
 * Sort le quadruplet READ / WRITE / diff / clear des mappers bespoke par entité et le rend déclaratif
 * sur le `FieldDescriptor` (`path`, `read`, `write`, `clear`, `atomicGroup`), exécuté ici :
 *  - `seedFromEntity` : entité serveur → valeurs de form (READ : path + transformer `read`)
 *  - `valuesToPayload` : valeurs de form → payload serveur COMPLET (WRITE : transformer `write` + path)
 *  - `diffForEdit`     : payload (complet) vs baseline → delta à envoyer (modifiés + EFFACÉS), atomic-aware
 *
 * Modèle « payload COMPLET » (vs builders bespoke qui omettent les vides) : on émet TOUS les champs, et
 * le diff décide quoi envoyer. Un champ vidé devient une clé MODIFIÉE vers vide → branche clear → le bug
 * d'effacement est absorbé NATIVEMENT (plus de réconciliation ad-hoc des clés absentes).
 *
 * Les GROUPES DE SÉRIALISATION (N champs plats ↔ 1 objet serveur : address 14 clés, socialNetwork 9 clés,
 * openingHours) sont câblés via `descriptor.serializeGroups` + `field.group` (read = objet serveur → valeurs
 * plates des membres ; write = valeurs de form → objet serveur, `undefined` = clé omise).
 */
import type { FormDescriptor, FieldDescriptor, FormValues } from "../types";
import { applyTransform } from "./transforms";
import { isSameValue } from "./reconcile";

/** Clé de stockage serveur d'un champ : `path` si défini, sinon `name`. */
const storeKey = (f: FieldDescriptor): string => f.path ?? f.name;

/**
 * Valeur émise pour EFFACER un champ : `field.clear` explicite, sinon dérivée du type (`[]` array, `""` sinon).
 * ⚠ Jamais `{}` : un objet vidé (ex. socialNetwork) s'efface via `""` (le SDK costum `null/""/[]` → `$unset` ;
 * `{}` est mergé côté backend → no-op). cf. reconcile.ts.
 */
export function clearValue(field: FieldDescriptor): unknown {
  if (field.clear !== undefined) return field.clear;
  return field.type === "array" ? [] : "";
}

/** Une valeur est-elle « vide » (à traiter comme effacement) ? `null`/`undefined`/`""`/`[]`/`{}`. */
function isEmptyValue(v: unknown): boolean {
  if (v == null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/**
 * READ — entité serveur → valeurs de form PLATES. Pour chaque champ : lit `serverData[path ?? name]` puis
 * applique `field.read` (transformer nommé). Pur, statique (aucune dépendance réseau/instance).
 */
export function seedFromEntity(descriptor: FormDescriptor, serverData: FormValues): FormValues {
  const values: FormValues = {};
  // 1. Groupes : objet serveur → valeurs PLATES des membres (ex. serverData.address → addressCountry/…).
  for (const g of Object.values(descriptor.serializeGroups ?? {})) {
    const decomposed = applyTransform(g.read, serverData[g.serverKey], serverData);
    if (decomposed && typeof decomposed === "object") Object.assign(values, decomposed as FormValues);
  }
  // 2. Champs simples (hors groupe) : serverData[path ?? name] + read, puis DÉFAUT si vide.
  for (const field of Object.values(descriptor.fields)) {
    if (field.group) continue; // valeur fournie par son groupe (étape 1)
    const raw = serverData[storeKey(field)];
    let v = field.read ? applyTransform(field.read, raw, serverData) : raw;
    // Champ vide côté serveur → `field.default` (parité `buildEditDefaults` : `toX(server) || defaults.X`).
    // Couvre AUSSI la création (serverData = {}) : tous les champs retombent sur leur défaut.
    if (isEmptyValue(v) && field.default !== undefined) v = field.default;
    values[field.name] = v;
  }
  return values;
}

/**
 * WRITE — valeurs de form → payload serveur COMPLET. Pour chaque champ : applique `field.write` puis écrit
 * à `path ?? name`. Émet TOUS les champs (vides compris) — le diff décide quoi envoyer.
 */
export function valuesToPayload(descriptor: FormDescriptor, values: FormValues): FormValues {
  const payload: FormValues = {};
  for (const field of Object.values(descriptor.fields)) {
    if (field.group) continue; // recomposé par son groupe (ci-dessous)
    const v = field.write ? applyTransform(field.write, values[field.name], values) : values[field.name];
    payload[storeKey(field)] = v;
  }
  // Groupes : valeurs plates → 1 objet serveur (`undefined` = clé omise, ex. adresse sans localityId).
  for (const g of Object.values(descriptor.serializeGroups ?? {})) {
    const obj = applyTransform(g.write, values, values);
    if (obj !== undefined) payload[g.serverKey] = obj;
  }
  return payload;
}

/**
 * DIFF d'édition baseline-aware — `payload` (complet, via valuesToPayload) vs `baseline` (= payload reconstruit
 * depuis l'entité serveur) → delta à appliquer/envoyer. Inchangé → omis ; modifié → valeur ; vidé → `clearValue`
 * (effacement explicite, jamais `{}`). `atomicGroup` : si UN champ du groupe change, TOUT le groupe est émis
 * (évite l'écrasement lossy, ex. adresse). `skip` exclut des clés (traitées à part : tags mergés, etc.).
 */
export function diffForEdit(
  descriptor: FormDescriptor,
  payload: FormValues,
  baseline: FormValues,
  opts: { skip?: readonly string[] } = {},
): FormValues {
  const skip = new Set(opts.skip ?? []);
  const fieldByKey = new Map<string, FieldDescriptor>();
  const atomicMembers = new Map<string, string[]>();
  for (const f of Object.values(descriptor.fields)) {
    const k = storeKey(f);
    fieldByKey.set(k, f);
    if (f.atomicGroup) {
      const arr = atomicMembers.get(f.atomicGroup) ?? [];
      arr.push(k);
      atomicMembers.set(f.atomicGroup, arr);
    }
  }

  const emit = (key: string, delta: FormValues): void => {
    const field = fieldByKey.get(key);
    const v = payload[key];
    delta[key] = isEmptyValue(v) ? (field ? clearValue(field) : "") : v;
  };

  const delta: FormValues = {};
  const changedAtomic = new Set<string>();
  for (const key of new Set([...Object.keys(payload), ...Object.keys(baseline)])) {
    if (skip.has(key)) continue;
    if (isSameValue(payload[key], baseline[key])) continue; // inchangé → omis
    const group = fieldByKey.get(key)?.atomicGroup;
    if (group) { changedAtomic.add(group); continue; } // traité en bloc ci-dessous
    emit(key, delta);
  }
  // Groupes atomiques modifiés : émettre TOUS leurs membres (valeur courante, ou clear si vide).
  for (const group of changedAtomic) {
    for (const key of atomicMembers.get(group) ?? []) {
      if (!skip.has(key)) emit(key, delta);
    }
  }
  return delta;
}
