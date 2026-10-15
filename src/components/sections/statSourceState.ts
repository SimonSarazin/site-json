/**
 * L'état d'un chiffre COMPTÉ de tuile de stat (`cta-card-grid.props.stats[].source`,
 * `stats.props.items[].source`), un hook par type de source — `StatValue` aiguille sur
 * `source.type` pour que chaque tuile ne monte que les hooks de SA source.
 *
 * Fetch CÔTÉ CLIENT uniquement, comme le dashboard admin dont cette logique est le pendant
 * public : pendant le SSR, chaque source est « en attente ». Source `aacCommuns` :
 * `useAacCommunsCountState` (module AAC).
 */
import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useEntityMembers } from "@/modules/profil/hooks/useMembersQuery";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
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

/**
 * Préfixe COMMUN à tous les comptes de recherche : la clé porte déjà le périmètre (type + baseParams),
 * donc deux tuiles — d'une section `stats` ou d'une `cta-card-grid` — qui comptent le même périmètre
 * partagent une seule requête.
 */
const SEARCH_COUNT_QUERY_PREFIX = "stat-search-count";
const NO_TAGS: Record<string, string[]> = {};
/** Le compte vit longtemps : une tuile ne mérite pas une requête à chaque visite. */
const SEARCH_COUNT_CACHE = { staleTime: 30 * 60 * 1000, gcTime: 60 * 60 * 1000 };

export function useSearchCountState(source: SearchCountSource): StatSourceState {
  const { entity } = useCocolight();
  const searchType = useMemo(() => ({ type: [source.entityType] }), [source.entityType]);
  // Seul le `count` de la réponse est lu : une page d'UN document, réduit à son nom — au lieu d'une
  // 1ʳᵉ page pleine (10 documents complets) transférée et transformée pour lire un entier.
  const baseParams = useMemo(
    () => ({ ...source.baseParams, indexStepList: 1, defaultFields: ["name"] }),
    [source.baseParams],
  );
  const { totalCount, hasCount, isPending } = useSearchQuery({
    queryKeyPrefix: SEARCH_COUNT_QUERY_PREFIX,
    searchText: "",
    searchTags: NO_TAGS,
    searchType,
    mapUsed: false,
    baseParams,
    cache: SEARCH_COUNT_CACHE,
  });
  // `totalCount` vaut 0 tant que la 1ʳᵉ page n'a pas apporté son `count` : seul `hasCount` le rend
  // fiable ; requête close sans lui = échec. Sans entité, la recherche ne part jamais (`isPending`
  // pour toujours) : une absence (cf. ci-dessous).
  const value = hasCount ? totalCount : null;
  return { value, unavailable: value == null && (!entity || !isPending) };
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
  // garde ses données : le chiffre déjà compté reste. L'attente se lit sur `isPending`, comme pour
  // la recherche : `isLoading` (= `isPending && isFetching`) prendrait pour une absence une requête
  // qui n'est simplement pas partie (hors ligne, avant abonnement).
  const value = entity && members.hasCount ? members.totalCount : null;
  return { value, unavailable: value == null && (!entity || !members.isPending) };
}
