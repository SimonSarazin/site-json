import { useQuery } from "@tanstack/react-query";
import { useInteropUserLinks } from "./useUserInteropLinks";
import { useInteropConfig } from "./useInteropConfigQuery";
import { useCocolight } from "@/hooks/useCocolight";
import { INTEROP_QUERY_KEYS } from "../constants/queryKeys";
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
    queryKey: INTEROP_QUERY_KEYS.MEDIAWIKI_CONTRIBS(entity?.id ?? null, wikiUsername ?? null),
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
