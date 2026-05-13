import { useQuery } from "@tanstack/react-query";
import { useInteropConfig } from "./useInteropConfigQuery";
import { useInteropUserLinks } from "./useUserInteropLinks";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";

export interface DiscourseProfilResult {
  summary?: Record<string, unknown>;
  profileUrl?: string;
  error?: string;
}

export function useDiscourseProfilQuery() {
  const { entity } = useCocolight();
  const { hasDiscourse } = useInteropConfig();
  const { discourseUsername, isDiscourseLinked } = useInteropUserLinks();

  return useQuery<DiscourseProfilResult>({
    queryKey: ["discourse-profil", entity?.id, discourseUsername],
    queryFn: async () => {
      return (entity as EntityTypes & { getDiscourseProfile(username: string): Promise<DiscourseProfilResult> }).getDiscourseProfile(discourseUsername!);
    },
    enabled: !!entity && hasDiscourse && isDiscourseLinked && !!discourseUsername,
    staleTime: 5 * 60 * 1000,
  });
}
