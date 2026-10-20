/**
 * Listing paginé des communs d'un AAC.
 *
 * Vrai hook React Query — clé, états de chargement, scroll infini. Seul son
 * `queryFn` délègue au transport, qui décide COMMENT les communs arrivent.
 * L'UI ne sait donc pas qu'elle est servie par une fixture, et ne le saura pas
 * davantage le jour où l'endpoint la remplacera.
 *
 * On utilise le hook de scroll GÉNÉRIQUE, pas ses variantes « Next » : celles-ci
 * chaînent un `PaginatorPage` du SDK, forme que le transport masque justement.
 */
import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Form } from "@communecter/cocolight-api-client";
import { useInfiniteQueryScroll } from "@/hooks/useInfiniteQueryScroll";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import {
  fetchAacCommunsPage,
  type AacCommunsPage,
  type AacScanMemoizer,
} from "../lib/communsTransport";
import { aacFiltersKey, type AacDirectoryFiltersState } from "../lib/filtersKey";
import { PUBLIC_AAC_VISIBILITY, type AacVisibility } from "../lib/aacQueryParams";
import type { AacCardFields } from "../lib/resolveAacCardFields";
import type { AacCommunCard } from "../lib/parseAacAnswer";

export interface UseAacCommunsParams {
  formId: string | null;
  /**
   * L'instance `Form` rattachée à l'entité costum (cf. `useAacFormEntity`).
   * `null` tant qu'elle n'est pas chargée — la requête reste alors désactivée.
   */
  form: Form | null;
  fields: AacCardFields | null;
  /** ⚠️ `q` doit arriver DÉJÀ debouncé, sinon une requête par frappe. */
  filters: AacDirectoryFiltersState;
  pageSize?: number;
  /** Isolation par campagne — `null` tant que la dimension n'est pas livrée. */
  campaignId?: string | null;
  contextId?: string | null;
  baseUrl?: string;
  enabled?: boolean;
  /** Qui regarde — entre dans la query key, la liste en dépend. */
  visibility?: AacVisibility;
}

export interface UseAacCommunsResult {
  communs: AacCommunCard[];
  /** Total APRÈS filtrage — ce qu'affiche « N RÉSULTATS ». */
  totalCount: number;
  isLoading: boolean;
  isPending: boolean;
  /** Un fetch est en vol — première page, page suivante OU refetch complet. */
  isFetching: boolean;
  isFetchingNextPage: boolean;
  /** L'`error` vient d'un `fetchNextPage` : les pages déjà chargées sont intactes. */
  isFetchNextPageError: boolean;
  hasNextPage: boolean | undefined;
  fetchNextPage: () => Promise<unknown>;
  lastItemRef: ReturnType<typeof useInfiniteQueryScroll<AacCommunsPage>>["lastItemRef"];
  error: Error | null;
  refetch: () => Promise<unknown>;
}

const DEFAULT_PAGE_SIZE = 12;

/**
 * Fraîcheur du listing ET de son balayage — la MÊME, à dessein : un balayage plus
 * frais que le listing serait refait pour rien, un balayage plus vieux servirait
 * à un listing qui vient d'être refetché des documents qu'il croit périmés.
 */
const STALE_TIME = 60 * 1000;

export function useAacCommuns({
  formId,
  form,
  fields,
  filters,
  pageSize = DEFAULT_PAGE_SIZE,
  campaignId = null,
  contextId = null,
  baseUrl = "",
  enabled = true,
  visibility = PUBLIC_AAC_VISIBILITY,
}: UseAacCommunsParams): UseAacCommunsResult {
  const filtersKey = aacFiltersKey(filters, { pageSize });
  const queryClient = useQueryClient();

  /**
   * Le balayage vit dans le cache React Query, sous une clé PROPRE à sa requête
   * serveur (cf. `COMMUNS_SCAN`). `fetchQuery` le sert tel quel tant qu'il est
   * frais et non invalidé, sinon le refait : la page 0 le paie, les suivantes le
   * relisent. Une invalidation du listing (dépôt, sélection) le marque périmé
   * avec lui — la première page rejouée le refait, une seule fois pour toutes.
   */
  const memoizeScan = useCallback<AacScanMemoizer>(
    (serverParams, run) =>
      queryClient.fetchQuery({
        queryKey: AAC_QUERY_KEYS.COMMUNS_SCAN(
          formId,
          campaignId,
          serverParams,
          visibility.currentUserId
        ),
        queryFn: run,
        staleTime: STALE_TIME,
      }),
    [queryClient, formId, campaignId, visibility.currentUserId]
  );

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    isLoading,
    isPending,
    refetch,
    lastItemRef,
  } = useInfiniteQueryScroll<AacCommunsPage>({
    queryKey: AAC_QUERY_KEYS.COMMUNS(formId, campaignId, filtersKey, visibility.currentUserId),
    queryFn: ({ pageParam }) => {
      if (!form || !fields) throw new Error("AAC : formulaire ou champs non résolus");
      return fetchAacCommunsPage({
        form,
        fields,
        filters,
        page: typeof pageParam === "number" ? pageParam : 0,
        pageSize,
        contextId,
        baseUrl,
        visibility,
        memoizeScan,
      });
    },
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    options: {
      initialPageParam: 0,
      enabled: enabled && !!formId && !!form && !!fields,
      staleTime: STALE_TIME,
    },
  });

  const communs = useMemo(
    () => data?.pages?.flatMap((p) => p.communs) ?? [],
    [data?.pages]
  );

  return {
    communs,
    totalCount: data?.pages?.[0]?.total ?? 0,
    isLoading,
    isPending,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    lastItemRef,
    error: (error as Error) ?? null,
    refetch,
  };
}
