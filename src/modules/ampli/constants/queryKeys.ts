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
   * Consommateurs invalidants : `AmpliIdeaForm` après une soumission (la
   *   mutation coform n'invalide que ses propres caches) ; ailleurs, refetch
   *   via `refetch()` ou toggle d'`enabled`.
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
  /**
   * Nombre de propositions d'un ampli, pour la page liste `/ampli`.
   *
   * Producteur : `useAmpliAnswerCounts`
   * Sous le préfixe `FETCH_ANSWERS_PREFIX` À DESSEIN : l'invalidation que pose
   * `AmpliIdeaForm` après une soumission rafraîchit aussi ce compteur. Le segment
   * `"count"` ne peut pas entrer en collision avec une vue (`answers`/`map`/`split`).
   */
  ANSWERS_COUNT: (coformId: string, namePath: string) =>
    ["ampli-meeteem", coformId, "count", namePath] as const,
  /**
   * Coordonnées d'une commune (`cityAutocompleteByCountry`), pour placer les
   * contributeurs dont le profil n'a qu'une adresse.
   *
   * Producteur : `useContributorCities`
   * Clé par COMMUNE (et non par contributeur) : deux contributeurs d'une même
   * ville partagent l'entrée, et le cache est très long (une commune ne bouge pas).
   */
  CITY_GEO: (localityId: string) => ["ampli-city-geo", localityId] as const,
} as const;

export type AmpliQueryKeyType = ReturnType<
  (typeof AMPLI_QUERY_KEYS)[keyof typeof AMPLI_QUERY_KEYS]
>;
