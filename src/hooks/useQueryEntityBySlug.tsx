import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { useCocolight } from "./useCocolight";
import { useMemo } from "react";
import type { SearchEntity } from "@/modules/search/schema";
import { isEntityInstance } from "@/helpers/isEntityInstance";

interface QueryEntityBySlugProps {
  slug: string | undefined;
  options?: Omit<
    UseQueryOptions,
    "queryKey" | "queryFn"
  >;
}

export const useQueryEntityBySlug = ({ slug, options = {} }: QueryEntityBySlugProps) => {
  const { organization, loading, helper, me } = useCocolight();

  // Le type unknown car l'API peut retourner soit une instance, soit du JSON déshydraté
  const { data, isLoading, isError, error, refetch } = useQuery<unknown>({
    queryKey: ["element-about", slug],
    queryFn: async () => {
      if (!slug) throw new Error("Slug manquant");
      if (!organization) throw new Error("API non initialisée");
      if(me && slug === me.slug) {
        return me;
      }
      return organization.entityBySlug(slug);
    },
    enabled: !!slug && !loading && !!organization,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    ...options,
  });

  // Transformation des résultats lier à la deshydratation pour le SSR
  const transformedResults = useMemo(() => {
      if (!data) return null;

      // Si c'est déjà une instance (retour direct de l'API)
      if (isEntityInstance(data)) return data;

      // Sinon, c'est du JSON déshydraté qu'il faut réhydrater
      return helper.fromEntityJSON(data, organization) as SearchEntity;
  }, [data, organization, helper]);

  return {
    data: transformedResults,
    isLoading,
    isError,
    error,
    refetch,
  };
};