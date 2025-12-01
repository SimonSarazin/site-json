import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useEffect } from "react";
import type { SearchEntity } from "@/modules/search/schema";
import { useCocolight } from "@/hooks/useCocolight";
import { transformToEntityInstance } from "@/lib/entityTransform";
import cocolightApiClient from "@communecter/cocolight-api-client";

const { isReactive } = cocolightApiClient;

interface QueryEntityBySlugProps {
  slug: string | undefined;
  options?: Omit<
    UseQueryOptions,
    "queryKey" | "queryFn"
  >;
}

export const useEntityBySlugQuery = ({ slug, options = {} }: QueryEntityBySlugProps) => {
  const { entity, loading, helper, me } = useCocolight();
  const queryClient = useQueryClient();

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

  // Transformer le cache une seule fois après l'hydratation SSR
  useEffect(() => {
    if (!slug || !entity) return;

    const currentData = queryClient.getQueryData<unknown>(["element-about", slug]);

    if (currentData && typeof currentData === 'object' && currentData !== null && 'serverData' in currentData) {
      // Vérifier si c'est un plain object (après SSR)
      if (!isReactive((currentData as any).serverData)) {
        if (import.meta.env.DEV) {
          console.log("🔄 Transformation du cache de l'entité après hydratation SSR");
        }
        // Transformer le cache en instance Proxy
        queryClient.setQueryData(["element-about", slug],
          transformToEntityInstance<SearchEntity>(currentData, helper, entity)
        );
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Les données du cache sont déjà des instances Proxy (transformées dans useEffect ou queryFn)
  return {
    data: data as SearchEntity | null,
    isLoading,
    isError,
    error,
    refetch,
  };
};