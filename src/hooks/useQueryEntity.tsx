import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { useCocolight } from "./useCocolight";

interface QueryEntityBySlugProps {
  slug: string;
  options?: Omit<
    UseQueryOptions,
    "queryKey" | "queryFn"
  >;
}

export const useQueryEntityBySlug = ({ slug, options = {} }: QueryEntityBySlugProps) => {
  const { organization, loading } = useCocolight();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["element-about", slug],
    queryFn: async () => {
      if (!organization) throw new Error("API non initialisée");
      // const fn = organization.entityBySlug as (slug: string) => Promise<T>;
      return organization.entityBySlug(slug);
    },
    enabled: !!slug && !loading && !!organization,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    ...options,
  });

  return {
    data,
    isLoading,
    isError,
  };
};