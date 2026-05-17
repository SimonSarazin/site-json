import { useQuery } from "@tanstack/react-query";
import { useInteropUserLinks } from "./useUserInteropLinks";
import { useInteropConfig } from "./useInteropConfigQuery";
import { useCocolight } from "@/hooks/useCocolight";
import {
  asInteropEntity,
  type MediawikiContribsResult,
  type WikiContrib,
} from "./_interopEntity";

// Re-export pour les consommateurs externes.
export type { WikiContrib, MediawikiContribsResult };

export function useMediawikiContribsQuery(limit = 10) {
  const { entity } = useCocolight();
  const { hasWiki } = useInteropConfig();
  const { wikiUsername, isWikiLinked } = useInteropUserLinks();

  return useQuery<MediawikiContribsResult>({
    queryKey: ["mediawiki-contribs", entity?.id, wikiUsername],
    queryFn: async () => {
      if (!entity || !wikiUsername) {
        throw new Error("MediaWiki contributions query enabled without entity/username");
      }
      return asInteropEntity(entity).getMediaWikiContributions(wikiUsername, limit);
    },
    enabled: !!entity && hasWiki && isWikiLinked && !!wikiUsername,
    staleTime: 5 * 60 * 1000,
  });
}
