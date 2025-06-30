import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import { useCocolight } from "./useCocolight";

interface QueryEntityBySlugProps {
  slug: string;
  options?: UseQueryOptions;
}

export const useQueryEntityBySlug = ({ slug, options = {} }: QueryEntityBySlugProps) => {
  const { organization } = useCocolight();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["element-about", slug],
    queryFn: () => organization.entityBySlug(slug),
    enabled: !!slug,
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