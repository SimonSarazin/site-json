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

  // Listing des communs d'un AAC, ISOLÉ PAR CAMPAGNE.
  //
  // ⚠️ USER-SCOPÉ depuis la bascule sur `directoryproposal` : un visiteur non
  // administrateur ne reçoit que les communs SÉLECTIONNÉS plus les siens
  // (filtre `$or` posé par `splitAacFilters`). Deux visiteurs différents n'ont
  // donc pas la même liste — d'où `userId` en DERNIER segment, faute de quoi le
  // cache d'un admin serait servi à un anonyme.
  // Producteur : useAacCommuns
  COMMUNS: (
    formId: string | null,
    campaignId: string | null = null,
    filtersKey: string | null = null,
    userId: string | null = null
  ) => ["aac-communs", formId, campaignId, filtersKey, userId] as const,
  COMMUNS_PREFIX: () => ["aac-communs"] as const,

  // Cardinal de la population VISIBLE d'un AAC (mode `countonly`), ISOLÉ PAR
  // CAMPAGNE. User-scopé pour la même raison que COMMUNS : deux visiteurs ne
  // voient pas le même ensemble, donc ne comptent pas le même nombre.
  // Volontairement DISTINCT de COMMUNS : le décompte ignore les filtres de
  // l'annuaire, et il doit survivre à leur changement sans être refetché.
  // Producteur : useAacCommunsCount
  COUNT: (
    formId: string | null,
    campaignId: string | null = null,
    userId: string | null = null
  ) => ["aac-count", formId, campaignId, userId] as const,
  COUNT_PREFIX: () => ["aac-count"] as const,

  // Options ET décomptes des facettes de l'annuaire (usage, tags). PUBLIC.
  // Volontairement DISTINCT de COMMUNS : les facettes se calculent sur le jeu
  // NON filtré, sinon cocher une option ferait disparaître les autres. Côté
  // legacy c'est une seconde requête (`setThemesCounts`, `indexStep: "0"`) ;
  // la séparation ici prépare cette bascule.
  // Producteur : useAacFacets
  // `userId` en dernier segment pour la même raison que COMMUNS : les décomptes
  // portent sur la population VISIBLE, qui dépend du visiteur.
  FACETS: (
    formId: string | null,
    campaignId: string | null = null,
    userId: string | null = null
  ) => ["aac-facets", formId, campaignId, userId] as const,
  FACETS_PREFIX: () => ["aac-facets"] as const,

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
