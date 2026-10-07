import { useInfiniteQueryScrollNextWithTransform } from "@/hooks/useInfiniteQueryScroll";
import { useMemo } from "react";
import type { QueryKey } from "@tanstack/react-query";
import type { PaginatorPage, EntityTypes } from "@communecter/cocolight-api-client";
import Cocolight from "@communecter/cocolight-api-client";

type CocolightHelper = typeof Cocolight.helper;

/**
 * Paramètres de pagination/recherche d'une liste infinie. `filters`/`fields` ne sont posés sur la
 * requête que s'ils sont NON VIDES — décidé ici, une seule fois, pour tous les appelants : un
 * `{}` ou un `[]` ne doit pas partir vers un endpoint qui ne les déclare pas.
 */
export interface InfiniteEntityQueryParams {
  indexStep?: number;
  search?: string;
  /** Filtre Mongo complémentaire sur les documents (fusionné côté SDK sous le filtre de lien). */
  filters?: Record<string, unknown>;
  /** Champs AJOUTÉS à la projection par défaut (jamais substitués). */
  fields?: string[];
}

export interface InfiniteEntityQueryConfig<TEntity, TResult> {
  /**
   * L'entité source (peut être null)
   */
  entity: TEntity | null;

  /**
   * Fonction pour vérifier si l'entité est du bon type
   */
  typeCheck: (e: TEntity) => boolean;

  /**
   * Query key de base
   */
  queryKey: QueryKey;

  /**
   * Fonction pour récupérer les données
   */
  fetchFn: (
    entity: TEntity,
    pagination: { name?: string; indexStep: number; filters?: Record<string, unknown>; fields?: string[] }
  ) => Promise<PaginatorPage<TResult>>;

  /**
   * Paramètres de pagination et recherche — cf. `InfiniteEntityQueryParams`.
   */
  params?: InfiniteEntityQueryParams;

  /**
   * Temps de péremption du cache (défaut: 5 minutes)
   */
  staleTime?: number;

  /**
   * Helper Cocolight pour transformation SSR (optionnel)
   * Si fourni, active la transformation automatique avec entity
   */
  helper?: CocolightHelper;
}

export interface InfiniteEntityQueryResult<TResult> {
  items: TResult[];
  /** 0 tant que la 1ʳᵉ page n'a pas apporté son `count` — ne le lire qu'avec `hasCount`. */
  totalCount: number;
  /** La 1ʳᵉ page a apporté son `count` : `totalCount` est un vrai total, pas le 0 d'attente. */
  hasCount: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  lastItemRef: (node: HTMLElement | null) => void;
  error: unknown;
  refetch: () => Promise<unknown>;
}

/**
 * Hook générique pour les queries infinies d'entités
 * Combine la pagination infinie avec le scroll automatique
 *
 * @example
 * const { items, totalCount, isLoading, lastItemRef } = useInfiniteEntityQuery({
 *   entity,
 *   typeCheck: isOrganization,
 *   queryKey: ["organization-members", entity?.slug],
 *   fetchFn: (e, pagination) => e.getMembers(pagination, options),
 *   params: { search, indexStep: 20 },
 * });
 *
 * @example
 * // Dans un composant de liste
 * return (
 *   <div>
 *     {items.map((item, i) => (
 *       <Card
 *         key={item.id}
 *         ref={i === items.length - 1 ? lastItemRef : undefined}
 *       >
 *         {item.name}
 *       </Card>
 *     ))}
 *   </div>
 * );
 */
export function useInfiniteEntityQuery<TEntity, TResult>({
  entity,
  typeCheck,
  queryKey,
  fetchFn,
  params,
  staleTime = 5 * 60 * 1000,
  helper,
}: InfiniteEntityQueryConfig<TEntity, TResult>): InfiniteEntityQueryResult<TResult> {
  const {
    data,
    totalCount,
    hasCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  } = useInfiniteQueryScrollNextWithTransform<TResult>({
    queryKey,
    queryFn: async () => {
      if (!entity || !typeCheck(entity)) {
        throw new Error("Invalid entity type");
      }

      const pagination = {
        name: params?.search,
        indexStep: params?.indexStep || 20,
        ...(params?.filters && Object.keys(params.filters).length > 0 ? { filters: params.filters } : {}),
        ...(params?.fields && params.fields.length > 0 ? { fields: params.fields } : {}),
      };

      return fetchFn(entity, pagination);
    },
    options: {
      enabled: !!entity && typeCheck(entity),
      staleTime,
      initialPageParam: undefined,
    },
    // Transformation SSR si helper est fourni
    transform: helper && entity ? { entity: entity as unknown as EntityTypes, helper } : undefined,
  });

  const items = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.results);
  }, [data]);

  return {
    items,
    totalCount,
    hasCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    lastItemRef,
    error,
    refetch,
  };
}
