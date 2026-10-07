/**
 * L'état d'un chiffre COMPTÉ de tuile de stat (`cta-card-grid.props.stats[].source`,
 * `stats.props.items[].source`), un hook par type de source — `StatValue` aiguille sur
 * `source.type` pour que chaque tuile ne monte que les hooks de SA source.
 *
 * Fetch CÔTÉ CLIENT uniquement, comme le dashboard admin dont cette logique est le pendant
 * public : pendant le SSR, chaque source est « en attente ». Source `aacCommuns` :
 * `useAacCommunsCountState` (module AAC).
 */
import { useCocolight } from "@/hooks/useCocolight";
import { useEntityMembers } from "@/modules/profil/hooks/useMembersQuery";
import { useSearchAllResults } from "@/modules/search/hooks/useSearchAllResults";
import type { StatDynamicSource } from "@/types/site-schema";

export interface StatSourceState {
  /** Le chiffre compté — `null` tant qu'il n'est pas connu, jamais un chiffre inventé. */
  value: number | null;
  /** Le chiffre ne viendra PAS (échec, source sans total) : une absence, pas une attente. */
  unavailable: boolean;
}

/** L'état « en attente » — pendant le chargement du chunk d'une source, par exemple. */
export const STAT_PENDING: StatSourceState = { value: null, unavailable: false };

type SearchCountSource = Extract<StatDynamicSource, { type: "searchCount" }>;
type MembersCountSource = Extract<StatDynamicSource, { type: "membersCount" }>;

/** @param queryKeyPrefix Préfixe de clé React Query, unique par tuile. */
export function useSearchCountState(source: SearchCountSource, queryKeyPrefix: string): StatSourceState {
  const { entity } = useCocolight();
  const { total, isPending } = useSearchAllResults({
    queryKeyPrefix,
    searchType: { type: [source.entityType] },
    baseParams: source.baseParams ?? {},
    // On ne veut que le total : la 1ʳᵉ page suffit (cf. useSearchAllResults.total).
    maxResults: 1,
  });
  // `total` n'est connu qu'avec le `count` de la 1ʳᵉ page ; requête close sans lui = échec. Sans
  // entité, la recherche ne part jamais (`isPending` pour toujours) : une absence (cf. ci-dessous).
  return { value: total, unavailable: total == null && (!entity || !isPending) };
}

export function useMembersCountState(source: MembersCountSource): StatSourceState {
  const { entity } = useCocolight();
  const members = useEntityMembers(entity, {
    // `?? false` explicite : le défaut Zod (`.default(false)`) ne s'applique qu'au `.parse()` du
    // config — un objet construit à la main arrive ici avec `toBeValidated: undefined`.
    toBeValidated: source.toBeValidated ?? false,
  });
  // L'entité du client est résolue AVANT son premier rendu (`useCocolightInit` suspend) : nulle, le
  // slug n'a pas été résolu — une absence, que `StatFigure` n'affiche qu'après hydratation (le
  // serveur, lui, peut ne pas l'avoir quand le client l'aura). Requête close sans `count` (échec,
  // type d'entité sans membres) : une absence aussi — jamais le 0 d'attente. Un refetch en échec
  // garde ses données : le chiffre déjà compté reste.
  const value = entity && members.hasCount ? members.totalCount : null;
  return { value, unavailable: value == null && (!entity || !members.isLoading) };
}
