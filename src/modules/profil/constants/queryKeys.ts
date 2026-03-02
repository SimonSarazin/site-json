/**
 * Constantes centralisées pour les query keys React Query
 * Évite les magic strings et assure la cohérence des invalidations
 */

export const QUERY_KEYS = {
  // Element/Entity queries (userContextId pour refetch auto quand le contexte change)
  ELEMENT_ABOUT: (slug: string | null, userContextId: string | null = null) => ["element-about", slug, userContextId] as const,
  // Préfixe pour invalidations (matche toutes les queries peu importe userContextId)
  ELEMENT_ABOUT_PREFIX: (slug: string | null) => ["element-about", slug] as const,

  // User friends queries
  USER_FRIENDS: (slug: string | null, userContextId: string | null = null) => ["user-friends", slug, userContextId] as const,
  USER_FRIENDS_PREFIX: (slug: string | null) => ["user-friends", slug] as const,
  USER_PENDING_FRIENDS: (slug: string | null, userContextId: string | null = null) => ["user-pending-friends", slug, userContextId] as const,
  USER_PENDING_FRIENDS_PREFIX: (slug: string | null) => ["user-pending-friends", slug] as const,
  USER_SENT_FRIEND_REQUESTS: (slug: string | null, userContextId: string | null = null) => ["user-sent-friend-requests", slug, userContextId] as const,
  USER_SENT_FRIEND_REQUESTS_PREFIX: (slug: string | null) => ["user-sent-friend-requests", slug] as const,
  USER_BLOCKED: (slug: string | null, userContextId: string | null = null) => ["user-blocked", slug, userContextId] as const,
  USER_BLOCKED_PREFIX: (slug: string | null) => ["user-blocked", slug] as const,

  // Organization queries
  ORGANIZATION_MEMBERS: (slug: string | null, userContextId: string | null = null) => ["organization-members", slug, userContextId] as const,
  ORGANIZATION_MEMBERS_PREFIX: (slug: string | null) => ["organization-members", slug] as const,

  // Project queries
  PROJECT_CONTRIBUTORS: (slug: string | null, userContextId: string | null = null) => ["project-contributors", slug, userContextId] as const,
  PROJECT_CONTRIBUTORS_PREFIX: (slug: string | null) => ["project-contributors", slug] as const,

  // Event queries
  EVENT_ATTENDEES: (slug: string | null, userContextId: string | null = null) => ["event-attendees", slug, userContextId] as const,
  EVENT_ATTENDEES_PREFIX: (slug: string | null) => ["event-attendees", slug] as const,

  // Membership queries
  USER_ORGANIZATIONS: (slug: string | null, userContextId: string | null = null) => ["user-organizations", slug, userContextId] as const,
  USER_ORGANIZATIONS_PREFIX: (slug: string | null) => ["user-organizations", slug] as const,
  USER_PROJECTS: (slug: string | null, userContextId: string | null = null) => ["user-projects", slug, userContextId] as const,
  USER_PROJECTS_PREFIX: (slug: string | null) => ["user-projects", slug] as const,
  USER_EVENTS: (slug: string | null, userContextId: string | null = null) => ["user-events", slug, userContextId] as const,
  USER_EVENTS_PREFIX: (slug: string | null) => ["user-events", slug] as const,
  USER_POIS: (slug: string | null, userContextId: string | null = null) => ["user-pois", slug, userContextId] as const,
  USER_POIS_PREFIX: (slug: string | null) => ["user-pois", slug] as const,

  // Search queries
  SEARCH_USERS: (userContextId: string | null = null) => ["search-users", userContextId] as const,
  SEARCH_USERS_PREFIX: () => ["search-users"] as const,

  // Answers by forms queries
  ANSWERS_BY_FORMS: (entityId: string | null, formIds: string[], userContextId: string | null = null) =>
    ["answers-by-forms", entityId, formIds, userContextId] as const,
  ANSWERS_BY_FORMS_PREFIX: (entityId: string | null) => ["answers-by-forms", entityId] as const,
} as const;

export type QueryKeyType = ReturnType<(typeof QUERY_KEYS)[keyof typeof QUERY_KEYS]>;
