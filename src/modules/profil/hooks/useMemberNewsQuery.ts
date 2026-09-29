import { useQuery } from "@tanstack/react-query";
import type { News, Organization } from "@communecter/cocolight-api-client";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";

/** Une actu, avec l'organisation dont elle a été récupérée — cf. commentaire du hook. */
export interface ActuDeLieu {
  news: News;
  lieu: Organization;
}

/**
 * Actus des organisations données — portage FIDÈLE de `GetLikedNewsAction.php` (legacy) : PAS un
 * filtre `source.key` sur `news` (une hypothèse initiale de ce chantier, invalidée en lisant le vrai
 * contrôleur, `~/dev/communecter-dev/modules/costum/controllers/actions/franceTierslieux/
 * GetLikedNewsAction.php`), mais un `getNews()` PAR organisation, fusionné et trié — le legacy
 * boucle `$likedElement` et appelle `news\GetAction::run($type, $orgId, …)` pour chacun.
 *
 * Chaque actu GARDE son organisation d'origine (`ActuDeLieu`) au lieu d'être aplatie en `News[]` nu.
 * Une PREMIÈRE version tentait de la RETROUVER après coup via `source.key` — page blanche en test
 * réel : `source.key` trace le COSTUM AMBIANT du site au moment de la création (cf.
 * `useNewsMutations.tsx`), pas l'organisation propriétaire de l'actu, donc la correspondance échouait
 * systématiquement, et `NewsItem` rend `null` sans `currentEntity` résolue (`!formattedNews ||
 * !currentEntity`) — chaque item invisible, la liste entière en silence. On connaît déjà l'org au
 * moment du fetch (un `getNews()` PAR organisation) : il suffit de ne pas la perdre en aplatissant.
 *
 * `Organization.getNews()` (`BaseEntity.getNews`) n'est PAS paginé côté SDK (`Promise<News[]>`
 * simple, défaut 12 par organisation) : fusionner un scroll infini par-dessus N appels non alignés
 * exigerait de reproduire la pagination du legacy sans la connaître — hors scope ici.
 */
export function useMemberNewsQuery(
  organizations: readonly Organization[],
  options?: { perOrgLimit?: number; enabled?: boolean },
) {
  const orgIds = organizations.map((o) => o.id).filter((v): v is string => !!v).sort();

  return useQuery<ActuDeLieu[]>({
    queryKey: [...PROFIL_QUERY_KEYS.MEMBER_NEWS(orgIds), options?.perOrgLimit],
    queryFn: async () => {
      const parLieu = await Promise.all(
        organizations.map(async (lieu) => {
          const news = await lieu.getNews({ indexStep: options?.perOrgLimit ?? 12 });
          return news.map((n): ActuDeLieu => ({ news: n, lieu }));
        }),
      );
      return fusionnerEtTrierActus(parLieu.flat());
    },
    enabled: orgIds.length > 0 && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fusion + tri par date décroissante (`News::sortNews($allNews, ['updated' => SORT_DESC])`). */
export function fusionnerEtTrierActus(actus: readonly ActuDeLieu[]): ActuDeLieu[] {
  const dateDe = (a: ActuDeLieu) => Number((a.news.serverData as { updated?: unknown } | undefined)?.updated ?? 0);
  return [...actus].sort((a, b) => dateDe(b) - dateDe(a));
}
