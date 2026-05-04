import { useQuery } from "@tanstack/react-query";
import { useInteropUserLinks } from "./useUserInteropLinks";
import { useInteropConfig } from "./useInteropConfigQuery";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";

export interface WikiContrib {
  title?: string;
  timestamp?: string;
  comment?: string;
  revid?: number;
  [k: string]: unknown;
}

export interface MediawikiContribsResult {
  result: boolean;
  contribs?: WikiContrib[] | Record<string, unknown> | null;
}

export function useMediawikiContribsQuery(limit = 10) {
  const { entity } = useCocolight();
  const { hasWiki } = useInteropConfig();
  const { wikiUsername, isWikiLinked } = useInteropUserLinks();

  return useQuery<MediawikiContribsResult>({
    queryKey: ["mediawiki-contribs", entity?.id, wikiUsername],
    queryFn: async () => {
      return (
        entity as EntityTypes & {
          getMediaWikiContributions(
            username: string,
            limit?: number
          ): Promise<MediawikiContribsResult>;
        }
      ).getMediaWikiContributions(wikiUsername!, limit);
    },
    enabled: !!entity && hasWiki && isWikiLinked && !!wikiUsername,
    staleTime: 5 * 60 * 1000,
  });
}
