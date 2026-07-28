/**
 * Query keys React Query du module AAC (Appel à Communs).
 *
 * Convention « or » (cf. src/lib/queryKeys.ts) : SCREAMING_SNAKE, `as const` sur
 * l'objet ET chaque retour, type via `ReturnType`, variante `*_PREFIX()`.
 *
 * ⚠️ Spécificité AAC — ISOLATION PAR CAMPAGNE : une campagne isole ses communs,
 * financements, paniers et stats (cf. spec métier). La dimension `campaignId`
 * entre donc dans les clés des données scopées campagne. La dimension `userId`
 * reste en DERNIER segment sur les données user-scopées (mes votes / éval /
 * financements / « vu »), et est ABSENTE des données publiques (config, listing)
 * pour préserver la mutualisation du cache.
 */
export const AAC_QUERY_KEYS = {
  // Config résolue d'un AAC (form parent + aapConfig + inputs). PUBLIQUE.
  // Producteur : useAacConfig
  // Consommateurs invalidants : (à venir) éditeur de config AAC
  CONFIG: (formId: string | null) => ["aac-config", formId] as const,
  CONFIG_PREFIX: () => ["aac-config"] as const,

  // Listing des communs d'un AAC, ISOLÉ PAR CAMPAGNE. PUBLIC → pas de userId.
  // Producteur : (à venir) useAacCommuns
  COMMUNS: (
    formId: string | null,
    campaignId: string | null = null,
    filtersKey: string | null = null
  ) => ["aac-communs", formId, campaignId, filtersKey] as const,
  COMMUNS_PREFIX: () => ["aac-communs"] as const,

  // Un commun (Answer). PUBLIC.
  // Producteur : (à venir) useAacCommun
  COMMUN: (answerId: string | null) => ["aac-commun", answerId] as const,
  COMMUN_PREFIX: () => ["aac-commun"] as const,

  // État user-scopé d'un commun (mes votes/éval/financements/vu), ISOLÉ PAR
  // CAMPAGNE, `userId` en DERNIER segment.
  // Producteur : (à venir) useMyCommunState
  MY_COMMUN_STATE: (
    answerId: string | null,
    campaignId: string | null = null,
    userId: string | null = null
  ) => ["aac-my-commun-state", answerId, campaignId, userId] as const,
  MY_COMMUN_STATE_PREFIX: () => ["aac-my-commun-state"] as const,
} as const;

export type AacQueryKeyType = ReturnType<
  (typeof AAC_QUERY_KEYS)[keyof typeof AAC_QUERY_KEYS]
>;
