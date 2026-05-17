import { useQuery } from "@tanstack/react-query";
import { useInteropConfig } from "./useInteropConfigQuery";
import { useInteropUserLinks } from "./useUserInteropLinks";
import { useCocolight } from "@/hooks/useCocolight";
import { asInteropEntity, type DiscourseProfilResult } from "./_interopEntity";

// Re-export pour les consommateurs qui importent via `@/modules/interop`.
export type { DiscourseProfilResult };

export function useDiscourseProfilQuery() {
  const { entity } = useCocolight();
  const { hasDiscourse } = useInteropConfig();
  const { discourseUsername, isDiscourseLinked } = useInteropUserLinks();

  return useQuery<DiscourseProfilResult>({
    queryKey: ["discourse-profil", entity?.id, discourseUsername],
    queryFn: async () => {
      if (!entity || !discourseUsername) {
        throw new Error("Discourse profile query enabled without entity/username");
      }
      return asInteropEntity(entity).getDiscourseProfile(discourseUsername);
    },
    enabled: !!entity && hasDiscourse && isDiscourseLinked && !!discourseUsername,
    staleTime: 5 * 60 * 1000,
  });
}
