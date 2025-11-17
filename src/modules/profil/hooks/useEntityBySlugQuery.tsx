import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { useMemo } from "react";
import type { SearchEntity } from "@/modules/search/schema";
import { useCocolight } from "@/hooks/useCocolight";
import { transformToEntityInstance } from "@/lib/entityTransform";

interface QueryEntityBySlugProps {
  slug: string | undefined;
  options?: Omit<
    UseQueryOptions,
    "queryKey" | "queryFn"
  >;
}

export const useEntityBySlugQuery = ({ slug, options = {} }: QueryEntityBySlugProps) => {
  const { entity, loading, helper, me } = useCocolight();

  // Le type unknown car l'API peut retourner soit une instance, soit du JSON déshydraté
  const { data, isLoading, isError, error, refetch } = useQuery<unknown>({
    queryKey: ["element-about", slug],
    queryFn: async () => {
      if (!slug) throw new Error("Slug manquant");
      if (!entity) throw new Error("API non initialisée");
      if(me && slug === me.slug) {
        return me;
      }
      return entity.entityBySlug(slug);
    },
    enabled: !!slug && !loading && !!entity,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    ...options,
  });

  // Transformation des résultats lier à la deshydratation pour le SSR
  const transformedResults = useMemo(() => {
    if (!entity) return null;
    if (!data) return null;
      
    return transformToEntityInstance<SearchEntity>(data, helper, entity);
  }, [data, entity, helper]);

  return {
    data: transformedResults,
    isLoading,
    isError,
    error,
    refetch,
  };
};