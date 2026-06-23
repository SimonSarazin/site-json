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
    if (field.group || field.writeOnly || field.renderOnly) continue; // groupe → étape 1 ; writeOnly/renderOnly → jamais relu
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
 * WRITE — valeurs de form → payload serveur. Pour chaque champ : applique `field.write` puis écrit à
 * `path ?? name`. Une valeur `undefined` (champ non posé OU `write` renvoyant `undefined` = « omettre »)
 * est OMISE ; les vides TYPÉS (`""`/`[]`/`false`/`0`) sont émis (le diff/clear les gère). Un `write`
 * renvoyant `undefined` sur vide reproduit donc l'omission des builders « complets » (CREATE), et le diff
 * efface en ÉDITION (clé absente + présente au baseline → clear).
 */
export function valuesToPayload(
  descriptor: FormDescriptor,
  values: FormValues,
  opts: { emitEmpty?: boolean } = {},
): FormValues {
  // emitEmpty=false (CRÉATION) : un `write` -> `undefined` = clé OMISE (omit-empty ; évite d'envoyer "" à un
  //   champ typé au create, ex. number, que l'AJV ADD rejetterait). Le backend strippe les vides de toute façon.
  // emitEmpty=true (ÉDITION) : on émet TOUS les champs éditables ; un vide -> CLEAR TYPÉ (""/[]) pour que le
  //   `Object.assign` au draft + `save()` (qui diffe en interne) efface ($unset) le champ vidé. cf. doc S6.
  const emitEmpty = opts.emitEmpty ?? false;
  const groups = descriptor.serializeGroups ?? {};
  const payload: FormValues = {};
  for (const field of Object.values(descriptor.fields)) {
    if (field.readOnly || field.renderOnly) continue; // readOnly/renderOnly → jamais émis au payload
    // Membre de groupe : recomposé par le groupe — SAUF si le groupe est groupReadOnly (alors émis ici).
    if (field.group && !groups[field.group]?.groupReadOnly) continue;
    let v = field.write ? applyTransform(field.write, values[field.name], values) : values[field.name];
    // writeOnly (ex. geo/geoPosition, posés par EditLocationTab AVEC l'adresse) : JAMAIS seedés au READ →
    // leur absence du form = "non fourni cette fois", PAS "effacé". On garde donc l'omit-empty même en édition
    // (sinon une édition sans toucher l'adresse effacerait le geo serveur). Émis seulement si réellement posé.
    if (emitEmpty && !field.writeOnly) {
      if (v === undefined || isEmptyValue(v)) v = clearValue(field); // vidé -> clear typé (false/0 NON vides : préservés)
      payload[storeKey(field)] = v;
    } else if (v !== undefined) {
      payload[storeKey(field)] = v;
    }
  }
  // Groupes : valeurs plates → 1 objet serveur (`undefined` = clé omise au create, ex. adresse sans localityId).
  // `groupReadOnly` : pas d'écriture au niveau groupe (les membres ont été émis individuellement ci-dessus).
  for (const g of Object.values(groups)) {
    if (g.groupReadOnly) continue;
    let obj = applyTransform(g.write, values, values);
    if (emitEmpty) {
      if (obj === undefined || isEmptyValue(obj)) obj = ''; // objet serveur vidé -> "" (JAMAIS {}/[] ; cf. clear)
      payload[g.serverKey] = obj;
    } else if (obj !== undefined) {
      payload[g.serverKey] = obj;
    }
  }
  return payload;
}
