/**
 * Query keys du module profil — centralisées (single source of truth).
 *
 * Convention : chaque producteur a sa clé complète + une variante `_PREFIX`
 * minimaliste pour invalidation cross-contexte (matche toutes les queries
 * peu importe `userContextId`).
 *
 * `userContextId` est inclus pour refetch auto quand le contexte utilisateur
 * change (logout/login) — sans cette dimension, deux users distincts dans la
 * même session pourraient se voir servir les données du premier depuis le
 * cache.
 *
 * Nommage : `PROFIL_QUERY_KEYS` (préfixé du module — convention identique à
 * `CAGNOTTE_QUERY_KEYS`, `NEWS_QUERY_KEYS`, `SEARCH_QUERY_KEYS`).
 */
export const PROFIL_QUERY_KEYS = {
  /**
   * Détails d'une entité (about: bio, address, links, etc.).
   * Producteur : `useElementAbout` (lecture profil)
   * Consommateurs invalidants : `useProfileMutations` (edit), `useAddMutations`,
   *   `useEditTiersLieu`, `useFriendsMutations`, `useRelationshipMutations`
   */
  ELEMENT_ABOUT: (slug: string | null, userContextId: string | null = null) =>
    ["element-about", slug, userContextId] as const,
  ELEMENT_ABOUT_PREFIX: (slug: string | null) => ["element-about", slug] as const,

  /**
   * Galerie d'images d'une entité (documents contentKey="slider", via `entity.getGallery`).
   * Producteur : `useGalleryImages`. Consommateurs invalidants : `useGalleryMutations` (add/delete inline).
   */
  GALLERY: (id: string | null) => ["profil-gallery", id] as const,

  /**
   * Liste des amis d'un user (3 statuts friends/pending/sent partagent la même
   * queryKey racine — différenciés via params du hook).
   * Producteur : `useFriendsQuery`
   * Consommateurs invalidants : `useFriendMutations` (accept/decline/remove)
   */
  USER_FRIENDS: (slug: string | null, userContextId: string | null = null) =>
    ["user-friends", slug, userContextId] as const,
  USER_FRIENDS_PREFIX: (slug: string | null) => ["user-friends", slug] as const,

  /**
   * Membres d'une organisation.
   * Producteur : `useMembersQuery`
   * Consommateurs invalidants : `useRelationshipMutations` (join/leave/promote/demote)
   */
  ORGANIZATION_MEMBERS: (slug: string | null, userContextId: string | null = null) =>
    ["organization-members", slug, userContextId] as const,
  ORGANIZATION_MEMBERS_PREFIX: (slug: string | null) => ["organization-members", slug] as const,

  /**
   * Contributeurs d'un projet.
   * Producteur : `useMembersQuery` (avec contextType=project)
   * Consommateurs invalidants : `useRelationshipMutations`
   */
  PROJECT_CONTRIBUTORS: (slug: string | null, userContextId: string | null = null) =>
    ["project-contributors", slug, userContextId] as const,
  PROJECT_CONTRIBUTORS_PREFIX: (slug: string | null) => ["project-contributors", slug] as const,

  /**
   * Participants d'un événement.
   * Producteur : `useMembersQuery` (avec contextType=event)
   * Consommateurs invalidants : `useRelationshipMutations` (attend/cancel)
   */
  EVENT_ATTENDEES: (slug: string | null, userContextId: string | null = null) =>
    ["event-attendees", slug, userContextId] as const,
  EVENT_ATTENDEES_PREFIX: (slug: string | null) => ["event-attendees", slug] as const,

  /**
   * Memberships d'un user (les orgs/projets/events/POI auxquels il appartient).
   * Producteur : `useMembershipQuery`
   * Consommateurs invalidants : `useRelationshipMutations`, `useAddMutations`
   */
  USER_ORGANIZATIONS: (slug: string | null, userContextId: string | null = null) =>
    ["user-organizations", slug, userContextId] as const,
  USER_ORGANIZATIONS_PREFIX: (slug: string | null) => ["user-organizations", slug] as const,
  USER_PROJECTS: (slug: string | null, userContextId: string | null = null) =>
    ["user-projects", slug, userContextId] as const,
  USER_PROJECTS_PREFIX: (slug: string | null) => ["user-projects", slug] as const,
  USER_EVENTS: (slug: string | null, userContextId: string | null = null) =>
    ["user-events", slug, userContextId] as const,
  USER_EVENTS_PREFIX: (slug: string | null) => ["user-events", slug] as const,
  USER_POIS: (slug: string | null, userContextId: string | null = null) =>
    ["user-pois", slug, userContextId] as const,
  USER_POIS_PREFIX: (slug: string | null) => ["user-pois", slug] as const,

  /**
   * Recherche d'utilisateurs (autocomplete contributeurs, etc.).
   * Producteur : composants Finder, modales de contributeurs
   * Consommateurs invalidants : aucun (cache court via staleTime)
   */
  SEARCH_USERS: (userContextId: string | null = null) => ["search-users", userContextId] as const,
  SEARCH_USERS_PREFIX: () => ["search-users"] as const,

  /**
   * Réponses CoForm liées à une entité (utilisé par profile sections custom :
   * ProfilTiersLieuxAbout, ProfileTiersLieuxInfo).
   * Producteur : `useGetAnswersByFormsQuery`
   * Consommateurs invalidants : `useEditTiersLieu`, `useAddMutations` (add tiers-lieu)
   */
  ANSWERS_BY_FORMS: (
    entityId: string | null,
    formIds: string[],
    userContextId: string | null = null,
  ) => ["answers-by-forms", entityId, formIds, userContextId] as const,
  ANSWERS_BY_FORMS_PREFIX: (entityId: string | null) => ["answers-by-forms", entityId] as const,

  /**
   * Liste paginée des abonnés d'une entité.
   * Producteur : `useProfilSubscribersQuery`
   */
  PROFILE_SUBSCRIBERS: (entityId: string | null, searchQuery: string | null = "") =>
    ["profile-subscribers", entityId, searchQuery] as const,
  PROFILE_SUBSCRIBERS_PREFIX: (entityId: string | null) =>
    ["profile-subscribers", entityId] as const,

  /**
   * Liste paginée des organisations liées à un user/entité.
   * Producteur : `useProfilOrganizationsQuery`
   * Consommateurs invalidants : `useOrganizationMutations` (add/remove)
   */
  PROFILE_ORGANIZATIONS: (
    entityId: string | null,
    entityType: string | null,
    searchQuery: string | null = "",
  ) => ["profile-organizations", entityId, entityType, searchQuery] as const,
  PROFILE_ORGANIZATIONS_PREFIX: (entityId: string | null) =>
    ["profile-organizations", entityId] as const,

  /**
   * Liste paginée des projets liés à un user/entité.
   * Producteur : `useProfilProjectsQuery`
   * Consommateurs invalidants : `useProjectMutations` (add/remove)
   */
  PROFILE_PROJECTS: (entityId: string | null, searchQuery: string | null = "") =>
    ["profile-projects", entityId, searchQuery] as const,
  PROFILE_PROJECTS_PREFIX: (entityId: string | null) =>
    ["profile-projects", entityId] as const,

  /**
   * Liste paginée des membres d'une entité (User|Organization).
   * Producteur : `useProfilMembersQuery`
   */
  PROFILE_MEMBERS: (entityId: string | null, searchQuery: string | null = "") =>
    ["profile-members", entityId, searchQuery] as const,
  PROFILE_MEMBERS_PREFIX: (entityId: string | null) =>
    ["profile-members", entityId] as const,

  /**
   * Entités liées (Projects/Events/POI) à une entité parent par type de relation.
   * Producteur : `useRelatedEntities`
   */
  RELATED_ENTITIES: (
    slug: string | null,
    relationType: string | null,
    params: unknown = null,
  ) => ["related-entities", slug, relationType, params] as const,
  RELATED_ENTITIES_PREFIX: (slug: string | null) =>
    ["related-entities", slug] as const,

  /**
   * Détails de votes (likes/reactions) sur un commentaire.
   * Producteur : `useCommentVotes`
   */
  COMMENT_VOTES: (commentId: string | null) => ["comment-votes", commentId] as const,
  COMMENT_VOTES_PREFIX: (commentId: string | null) => ["comment-votes", commentId] as const,
} as const;

export type ProfilQueryKeyType = ReturnType<
  (typeof PROFIL_QUERY_KEYS)[keyof typeof PROFIL_QUERY_KEYS]
>;
