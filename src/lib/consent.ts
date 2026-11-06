/**
 * Consentement cookies — source unique, côté client.
 *
 * Le choix de l'utilisateur vit dans `localStorage["cookie-consent"]` (clé historique de la
 * section `cookieConsent`), par CATÉGORIE (`necessary`, `analytics`, …). Ce module est le seul
 * à lire et écrire cette clé : le bandeau (`CookieConsentSection`) écrit, les intégrations
 * (`IntegrationsLoader`) lisent, et chaque écriture est diffusée par un événement `window`
 * pour que la mesure d'audience réagisse sans rechargement.
 *
 * SSR : aucun accès à `window` au module ; les lectures renvoient `null` (aucun choix).
 */
import { useSyncExternalStore } from "react";

export const CONSENT_STORAGE_KEY = "cookie-consent";
export const CONSENT_EVENT = "cookie-consent:change";
/** Catégorie lue par la mesure d'audience — l'id à donner dans `categories` du bandeau. */
export const ANALYTICS_CATEGORY = "analytics";

export interface ConsentRecord {
  /** `true` si l'utilisateur a accepté au moins les catégories cochées, `false` pour « Refuser ». */
  accepted: boolean;
  preferences: Record<string, boolean>;
  timestamp: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Interprète une valeur brute du stockage ; tout ce qui n'est pas un enregistrement complet vaut « aucun choix ». */
export function parseConsent(raw: string | null | undefined): ConsentRecord | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const { accepted, preferences, timestamp } = value as Partial<ConsentRecord>;
    if (typeof accepted !== "boolean" || !preferences || typeof preferences !== "object") return null;
    const prefs: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(preferences)) if (typeof v === "boolean") prefs[k] = v;
    return { accepted, preferences: prefs, timestamp: typeof timestamp === "string" ? timestamp : "" };
  } catch {
    return null;
  }
}

export function readConsent(storage: StorageLike | null = defaultStorage()): ConsentRecord | null {
  if (!storage) return null;
  try {
    return parseConsent(storage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Enregistre le choix et le diffuse (`CONSENT_EVENT`). `accepted` vaut `false` pour un refus
 * global (« Refuser ») et `true` dès que l'utilisateur a validé des préférences.
 */
export function writeConsent(
  preferences: Record<string, boolean>,
  accepted: boolean,
  storage: StorageLike | null = defaultStorage(),
): ConsentRecord {
  const record: ConsentRecord = { accepted, preferences: { ...preferences }, timestamp: new Date().toISOString() };
  try {
    storage?.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // stockage indisponible (navigation privée, quota) : le choix vaut pour la page courante
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
  return record;
}

/**
 * Choix pour UNE catégorie : `true`/`false` si l'utilisateur s'est prononcé, `null` sinon.
 * Un refus global (`accepted: false`) vaut refus de toute catégorie non requise, même absente
 * de `preferences` — le bandeau n'enregistre que les catégories qu'il connaissait à ce moment.
 */
export function consentFor(record: ConsentRecord | null, category: string): boolean | null {
  if (!record) return null;
  if (category in record.preferences) return record.preferences[category];
  return record.accepted ? null : false;
}

/** Abonnement aux changements : écriture locale (`CONSENT_EVENT`) et autre onglet (`storage`). */
export function subscribeConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CONSENT_STORAGE_KEY) onChange();
  };
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Instantané mémoïsé : `useSyncExternalStore` exige une référence stable tant que le stockage ne change pas. */
let cacheRaw: string | null | undefined;
let cacheRecord: ConsentRecord | null = null;
function snapshot(): ConsentRecord | null {
  const storage = defaultStorage();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(CONSENT_STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheRecord = parseConsent(raw);
  }
  return cacheRecord;
}
const serverSnapshot = (): ConsentRecord | null => null;

/** L'enregistrement courant, réactif ; `null` au SSR, pendant l'hydratation et tant qu'aucun choix n'est fait. */
export function useConsentRecord(): ConsentRecord | null {
  return useSyncExternalStore(subscribeConsent, snapshot, serverSnapshot);
}

/** Le choix réactif pour une catégorie (voir `consentFor`). */
export function useConsent(category: string): boolean | null {
  return consentFor(useConsentRecord(), category);
}
