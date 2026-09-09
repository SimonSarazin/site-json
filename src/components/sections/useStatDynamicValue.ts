import { useCocolight } from "@/hooks/useCocolight";
import { useEntityMembers } from "@/modules/profil/hooks/useMembersQuery";
import { useSearchAllResults } from "@/modules/search/hooks/useSearchAllResults";
import type { StatDynamicSource } from "@/types/site-schema";

/**
 * Résout la valeur RÉELLE d'un stat dynamique de `cta-card-grid` (`props.stats[].source`).
 * Renvoie `null` tant qu'elle n'est pas connue (pas de source, requête en cours, échec) —
 * jamais un chiffre inventé. Fetch CÔTÉ CLIENT uniquement, comme le dashboard admin dont
 * cette logique est le pendant public (pas de prefetch SSR pour cette itération).
 *
 * @param source `stat.source` du config (`undefined` = pas de source dynamique).
 * @param queryKeyPrefix Préfixe de clé React Query, unique par tuile appelante.
 */
export function useStatDynamicValue(
  source: StatDynamicSource | undefined,
  queryKeyPrefix: string,
): number | null {
  const { entity } = useCocolight();

  const isSearchCount = source?.type === "searchCount";
  const isMembersCount = source?.type === "membersCount";

  const searchCount = useSearchAllResults({
    queryKeyPrefix,
    searchType: isSearchCount ? { type: [source.entityType] } : null,
    baseParams: isSearchCount ? (source.baseParams ?? {}) : {},
    // On ne veut que le total : la 1ʳᵉ page suffit (cf. useSearchAllResults.total).
    maxResults: 1,
  });

  const membersCount = useEntityMembers(
    isMembersCount ? entity : null,
    // `?? false` explicite : le défaut Zod (`.default(false)`) ne s'applique qu'au
    // `.parse()` du config — un objet construit à la main (tests, config non re-parsée)
    // arrive ici avec `toBeValidated: undefined`.
    { toBeValidated: isMembersCount ? (source.toBeValidated ?? false) : undefined },
  );

  if (isSearchCount) return searchCount.total;
  // `totalCount` vaut 0 par défaut TANT que la 1ʳᵉ page n'est pas revenue (pas de champ
  // "connu/inconnu" côté useInfiniteEntityQuery) — sans le garde `isLoading`, un 0 de
  // chargement écraserait le repli statique avant que la vraie valeur soit connue.
  if (isMembersCount) return entity && !membersCount.isLoading ? membersCount.totalCount : null;
  return null;
}
