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

  // L'appel d'ORIGINE d'un commun (son nom + son contexte porteur), lu quand il a été
  // déposé ailleurs qu'ici. PUBLIQUE : un formulaire est le même pour tous les
  // visiteurs, connectés ou non.
  // Producteur : useCommunFundingContext
  // Consommateurs invalidants : aucun — un appel d'origine ne change pas depuis ce
  //   site ; `staleTime` 5 min suffit.
  ORIGIN_FORM: (formId: string | null) => ["aac-commun-origin-form", formId] as const,
  ORIGIN_FORM_PREFIX: () => ["aac-commun-origin-form"] as const,

  // Entité PORTEUSE du contexte de financement d'un commun — celle sur laquelle
  // interroger `fundingEnvelope` (cf. `useCommunFundingHost`). PUBLIQUE : c'est
  // l'entité du contexte, la même pour tous les visiteurs ; les droits jouent à
  // l'intérieur de l'enveloppe, pas sur la résolution de son hôte.
  // Producteur : useCommunFundingHost
  // Consommateurs invalidants : aucun — l'hôte d'un contexte ne change pas en cours
  //   de session ; `staleTime` 5 min suffit.
  FUNDING_HOST: (contextType: string | null, contextId: string | null) =>
    ["aac-funding-host", contextType, contextId] as const,
  FUNDING_HOST_PREFIX: () => ["aac-funding-host"] as const,

  // Entité `Project` liée à un commun — celle dont `isAdmin()` décide de la gestion
  // des paliers, et dont `oceco.milestones[]` sert de repli de synchronisation.
  //
  // `userId` en DERNIER segment : l'entité est résolue AVEC le contexte utilisateur
  // (`me.project({id})`), et porte donc des rôles propres au visiteur. Servir celle
  // d'un autre depuis le cache donnerait des droits qui ne sont pas les siens.
  // Producteur : useCommunProjectEntity
  // Consommateurs invalidants : useGenerateAacProject, useAssociateExistingAacProject
  //   (le projet lié change), et les mutations de paliers qui écrivent
  //   `oceco.milestones[]` (`actions/mutations/milestone`).
  COMMUN_PROJECT: (projectId: string | null, userId: string | null = null) =>
    ["aac-commun-project", projectId, userId] as const,
  COMMUN_PROJECT_PREFIX: () => ["aac-commun-project"] as const,

  // Contributeur·rices du PROJET d'un commun. PUBLIQUE — volontairement SANS
  // `userId` : la liste est lue par la recherche publique
  // (`GET_CONTRIBUTORS_NO_ADMIN`, `auth: none`), donc identique pour tous les
  // visiteurs, connectés ou non. Distincte de COMMUN_PROJECT, qui porte l'entité
  // AVEC son contexte utilisateur (donc les droits) : mutualiser les deux
  // servirait la liste d'un visiteur depuis le cache d'un autre.
  // Producteur : useCommunProjectContributors
  // Consommateurs invalidants : CommunContributorsSection (à la fermeture de la modale
  //   d'invitation, qui vient d'écrire un lien de contribution).
  COMMUN_CONTRIBUTORS: (projectId: string | null) =>
    ["aac-commun-contributors", projectId] as const,
  COMMUN_CONTRIBUTORS_PREFIX: () => ["aac-commun-contributors"] as const,

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
