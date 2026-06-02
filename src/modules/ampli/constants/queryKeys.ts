/**
 * Query keys du module ampli — centralisées (single source of truth).
 *
 * Convention : préfixe figé `"ampli-meeteem"` (au lieu d'un paramètre runtime
 * `queryKeyPrefix` qui était ambigu et permettait des fautes de frappe
 * silencieuses).
 *
 * `coformId` + `view` + sérialisation de `baseParams` différencient les
 * variantes ; `*_PREFIX` permet l'invalidation cross-vue pour un coform donné.
 */
export const AMPLI_QUERY_KEYS = {
  /**
   * Réponses CoForm paginées pour Meeteem (annuaire/carte/split).
   *
   * Producteur : `useFetchAnswerQuery` (`AmpliSectionRenderer`, `MeeteemSection`)
   * Consommateurs invalidants : aucun explicite — refetch via `refetch()` ou
   *   `enabled` toggle (le module ampli n'expose pas de mutations directes).
   */
  FETCH_ANSWERS: (coformId: string, view: string, baseParams?: unknown) =>
    [
      "ampli-meeteem",
      coformId,
      view,
      baseParams ? JSON.stringify(baseParams) : "{}",
    ] as const,
  /** Préfixe minimal — invalide toutes les vues d'un coform donné. */
  FETCH_ANSWERS_PREFIX: (coformId: string) => ["ampli-meeteem", coformId] as const,
} as const;

export type AmpliQueryKeyType = ReturnType<
  (typeof AMPLI_QUERY_KEYS)[keyof typeof AMPLI_QUERY_KEYS]
>;
