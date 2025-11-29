/**
 * Constantes centralisées pour les query keys React Query
 * Évite les magic strings et assure la cohérence des invalidations
 */

export const QUERY_KEYS = {
  // Element/Entity queries
  ELEMENT_ABOUT: (slug: string | null) => ["element-about", slug] as const,

  // User friends queries
  USER_FRIENDS: (slug: string | null) => ["user-friends", slug] as const,
  USER_PENDING_FRIENDS: (slug: string | null) => ["user-pending-friends", slug] as const,
  USER_SENT_FRIEND_REQUESTS: (slug: string | null) => ["user-sent-friend-requests", slug] as const,
  USER_BLOCKED: (slug: string | null) => ["user-blocked", slug] as const,

  // Organization queries
  ORGANIZATION_MEMBERS: (slug: string | null) => ["organization-members", slug] as const,

  // Project queries
  PROJECT_CONTRIBUTORS: (slug: string | null) => ["project-contributors", slug] as const,

  // Event queries
  EVENT_ATTENDEES: (slug: string | null) => ["event-attendees", slug] as const,

  // News queries
  ENTITY_NEWS: (slug: string | null) => ["entity-news", slug] as const,

  // Membership queries
  USER_ORGANIZATIONS: (slug: string | null) => ["user-organizations", slug] as const,
  USER_PROJECTS: (slug: string | null) => ["user-projects", slug] as const,
  USER_EVENTS: (slug: string | null) => ["user-events", slug] as const,
  USER_POIS: (slug: string | null) => ["user-pois", slug] as const,

  // Search queries
  SEARCH_USERS: () => ["search-users"] as const,
} as const;

export type QueryKeyType = ReturnType<(typeof QUERY_KEYS)[keyof typeof QUERY_KEYS]>;
