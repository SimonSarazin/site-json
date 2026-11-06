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

/**
 * Miroir mémoire du dernier choix écrit DANS CETTE PAGE : quand le stockage est indisponible ou
 * refuse l'écriture (navigation privée stricte, quota, données de site bloquées), le choix vaut
 * quand même pour la session courante — un refus ne doit jamais être ignoré en silence.
 */
let memoire: ConsentRecord | null = null;
/** Vrai dès qu'une écriture par défaut a échoué : le stockage « lit » mais ne retient pas, la mémoire fait foi. */
let ecritureEchouee = false;

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

export function readConsent(storage?: StorageLike | null): ConsentRecord | null {
  const explicite = storage !== undefined;
  const source = explicite ? storage : defaultStorage();
  if (explicite) {
    try {
      return source ? parseConsent(source.getItem(CONSENT_STORAGE_KEY)) : null;
    } catch {
      return null;
    }
  }
  return lireDefaut(source);
}

/**
 * Lecture par défaut : le stockage s'il est présent, lisible et a retenu les écritures ; sinon la
 * mémoire de la page. Un stockage présent et sain qui ne contient rien = « aucun choix » (pas de
 * fuite d'une mémoire d'une autre vie du module).
 */
function lireDefaut(source: StorageLike | null): ConsentRecord | null {
  if (!source || ecritureEchouee) return memoire;
  try {
    return parseConsent(source.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return memoire;
  }
}

/**
 * Enregistre le choix et le diffuse (`CONSENT_EVENT`). `accepted` vaut `false` pour un refus
 * global (« Refuser ») et `true` dès que l'utilisateur a validé des préférences.
 */
export function writeConsent(
  preferences: Record<string, boolean>,
  accepted: boolean,
  storage?: StorageLike | null,
): ConsentRecord {
  const record: ConsentRecord = { accepted, preferences: { ...preferences }, timestamp: new Date().toISOString() };
  const explicite = storage !== undefined;
  if (!explicite) memoire = record;
  try {
    (explicite ? storage : defaultStorage())?.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // stockage indisponible (navigation privée, quota) : `memoire` porte le choix pour la page courante
    if (!explicite) ecritureEchouee = true;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
  return record;
}

/**
 * Choix pour UNE catégorie : `true`/`false` si l'utilisateur s'est prononcé, `null` sinon.
 * Une catégorie absente de `preferences` (le bandeau ne la connaissait pas, ou n'a pas de
 * catégories du tout) suit le choix global : « Tout accepter » l'accepte, « Refuser » la refuse —
 * les deux boutons doivent être symétriques, sinon un opt-in sans catégories n'ouvrirait jamais.
 */
export function consentFor(record: ConsentRecord | null, category: string): boolean | null {
  if (!record) return null;
  if (category in record.preferences) return record.preferences[category];
  return record.accepted;
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
  if (!storage || ecritureEchouee) return memoire;
  let raw: string | null = null;
  try {
    raw = storage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return memoire;
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
