/**
 * Query keys du module ampli — centralisées comme dans cagnotte/profil/coform.
 *
 * Évite d'avoir les queryKey hardcodées inline dans les hooks ; permet
 * d'invalider proprement depuis des call-sites externes (mutations,
 * SSR prefetch).
 */

export const AMPLI_QUERY_KEYS = {
  /** Préfixe global des queries fetchAnswer. */
  FETCH_ANSWERS: (queryKeyPrefix: string, coformId: string, view: string, baseParams?: unknown) =>
    [queryKeyPrefix, coformId, view, baseParams ? JSON.stringify(baseParams) : "{}"] as const,

  /** Préfixe sans paramètres pour invalider toutes les vues d'un coform donné. */
  FETCH_ANSWERS_PREFIX: (queryKeyPrefix: string, coformId: string) =>
    [queryKeyPrefix, coformId] as const,
};
