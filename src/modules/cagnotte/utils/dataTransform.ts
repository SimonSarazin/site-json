/**
 * Helpers de transformation et d'extraction de données utilisés à travers le module cagnotte
 * (hooks, lib, components). Centralise les utilitaires qui étaient dupliqués entre :
 *  - `hooks/useFundingEnvelope.ts`
 *  - `lib/milestoneSyncContext.ts`
 *  - `hooks/useSaveCagnotteContribution.ts`
 *  - `components/PaymentConfigPage.tsx`
 *
 * Toutes les fonctions sont pures (aucun side-effect) — adaptées à `utils/` plutôt qu'à `lib/`.
 */

export type UnknownRecord = Record<string, unknown>;

/**
 * Coerce une valeur en `Record<string, unknown>`. Retourne `{}` pour `null`, `undefined`,
 * les primitives ou les valeurs non-objet. À utiliser comme garde-fou avant un accès dynamique.
 */
export function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

/**
 * Retourne le record s'il est non-vide, sinon `null`. Pratique pour les fallbacks
 * « prendre la première source non-vide » (cf. `getServerData`, `extractPaymentMethods`).
 */
export function getNonEmptyRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as UnknownRecord;
  return Object.keys(record).length > 0 ? record : null;
}

/**
 * Coerce en tableau : tableaux pass-through, objets → `Object.values`, sinon `[]`.
 * Utile pour les structures backend qui sont parfois sérialisées en `{ "0": ..., "1": ... }`.
 */
export function toArrayOrValues<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value as Record<string, T>);
  return [];
}

/**
 * Coerce en tableau en wrappant les valeurs scalaires : `null/undefined → []`,
 * tableau pass-through, autre valeur → `[value]`.
 */
export function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value == null) return [];
  return [value as T];
}

/**
 * Coerce en `number` finite. Retourne `0` pour `null`, `undefined`, `NaN`, `Infinity`.
 */
export function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Coerce en `string`. Retourne `''` pour toute valeur non-string (y compris numbers,
 * pour éviter les `"[object Object]"`).
 */
export function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Normalise une valeur en `string | null` : trim, retourne `null` si la chaîne devient vide
 * ou si la valeur n'est pas une string. Utile pour traiter des IDs / slugs optionnels où
 * `""` doit être traité comme « pas de valeur ».
 */
export function normalizeIdOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Coerce sûre vers un entier (tronque les décimales). Gère :
 *  - `number` finis → `Math.trunc(value)`
 *  - `string` (FR ou EN) : `"1 234,5"` → `1234`, `"42"` → `42`, `""` ou invalide → `0`
 *  - Tout autre type → `0`
 *
 * Utile pour les montants côté backend qui peuvent arriver indifféremment en number
 * (calculé local) ou en string (sérialisé EJSON).
 */
export function toSafeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".").trim();
    if (!normalized) return 0;
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Extrait l'id d'une référence d'entité côté backend, qui peut être :
 *  - une string brute (`"abc123"`)
 *  - un objet `{ id: "abc123" }`
 *  - un objet Mongo `{ _id: { $id | _str } }`
 *  - un objet `{ $id: "abc123" }`
 *
 * Retourne `''` si aucun id trouvé. Couvre les deux variantes historiquement utilisées
 * (`getEntityId` dans useFundingEnvelope et `getEntityIdFromUnknown` dans milestoneSyncContext).
 */
export function getEntityId(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const record = value as UnknownRecord;
  const direct = record.id;
  if (typeof direct === "string" && direct) return direct;

  const mongoId = asRecord(record._id);
  const dollarId = mongoId.$id;
  if (typeof dollarId === "string" && dollarId) return dollarId;

  const mongoStr = mongoId._str;
  if (typeof mongoStr === "string" && mongoStr) return mongoStr;

  const str = record.$id;
  if (typeof str === "string" && str) return str;

  return "";
}

/**
 * Retourne le sous-arbre `serverData` d'une Entity Cocolight (ou le record direct si
 * la valeur n'est pas une Entity). Les méthodes du SDK qui retournent des entités linkées
 * (cf. `BaseEntity.fundingEnvelope` → `_linkEntity`) rangent les données du document Mongo
 * sous `entity.serverData` (getter sur `_serverData`), pas à la racine de l'instance.
 *
 * Ce helper résout ce niveau d'indirection en cherchant `_serverData`, puis `serverData`,
 * puis fallback sur le record lui-même s'il est non-vide.
 */
export function getServerData(value: unknown): UnknownRecord {
  const record = asRecord(value);

  return (
    getNonEmptyRecord(record._serverData) ||
    getNonEmptyRecord(record.serverData) ||
    getNonEmptyRecord(record) ||
    {}
  );
}

/**
 * Lit le champ costum `preferences` d'une Entity Cocolight en tolérant les deux shapes :
 *  - `entity.data.preferences` (draft local, non-encore-sauvegardé)
 *  - `entity.serverData.preferences` (données serveur)
 *
 * Le champ `preferences` est costum-spécifique (non typé strict côté SDK), d'où le retour
 * en `UnknownRecord | undefined`. À utiliser quand on a besoin de distinguer draft vs server ;
 * sinon, `getServerData(entity).preferences` est plus court.
 */
export function readEntityPreferences(
  entity: unknown,
  source: "data" | "serverData",
): UnknownRecord | undefined {
  const root = asRecord(entity)[source];
  if (!root || typeof root !== "object") return undefined;
  const prefs = (root as UnknownRecord).preferences;
  return prefs && typeof prefs === "object" ? (prefs as UnknownRecord) : undefined;
}
