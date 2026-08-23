/**
 * Query keys TRANSVERSES — celles qui ne relèvent d'aucun module.
 *
 * Les clés propres à un module vivent dans `@/modules/<X>/constants/queryKeys` (single source of
 * truth) et sont re-exportées par `@/lib/queryKeys`. Celles-ci n'y ont pas leur place : leur donnée
 * est consommée par plusieurs modules à la fois, et l'invalidation doit les atteindre TOUS.
 *
 * Même convention « or » que les autres fichiers : `as const` partout, `*_PREFIX()` pour les
 * invalidations, JSDoc citant producteurs et consommateurs invalidants.
 */

export const COSTUM_QUERY_KEYS = {
  /**
   * Valeurs d'une liste DYNAMIQUE déclarée du costum (`costum.lists.<nom>`), résolues par
   * `costum/co/listvalues`.
   *
   * Producteur : `useCostumListValues` — et lui seul. Les listes STATIQUES ne passent pas par une
   * query : elles voyagent déjà dans le costum en mémoire, le hook les rend sans requête.
   *
   * Consommateurs invalidants : toute mutation d'entité qui écrit un champ alimentant une liste
   * dynamique — c'est le point même du widget, une valeur saisie librement doit apparaître aux
   * suivants. L'invalidation passe par `LIST_VALUES_PREFIX(slug)` : le champ écrit n'est pas connu
   * du muteur (il n'a pas la déclaration), et le coût d'un refetch de quelques kilooctets ne
   * justifie pas de le lui faire porter.
   *
   * Pas de dimension user : la liste est publique et scopée au costum, pas au visiteur. La clé porte en
   * revanche la RECHERCHE et le PLAFOND (`q`, `limit`) : deux requêtes qui ne demandent pas la même
   * tranche ne doivent pas se recouvrir en cache. `LIST_VALUES_PREFIX` les invalide toutes d'un coup.
   */
  LIST_VALUES: (slug: string | null, list: string | null, q?: string, limit?: number) =>
    ["costum-list-values", slug, list, q ?? "", limit ?? 0] as const,
  /** Toutes les listes d'un costum — cible d'invalidation après une mutation d'entité. */
  LIST_VALUES_PREFIX: (slug: string | null) => ["costum-list-values", slug] as const,
} as const;

export type CostumQueryKeyType = ReturnType<
  (typeof COSTUM_QUERY_KEYS)[keyof typeof COSTUM_QUERY_KEYS]
>;
