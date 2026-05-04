import { useCocolight } from "@/hooks/useCocolight";

export function useInteropConfig() {
  const { entity } = useCocolight();
  const costum = entity?.serverData?.costum as
    | Record<string, unknown>
    | undefined;
  const cfg = costum?.interop as Record<string, string> | undefined;
  return {
    discourseUrl: cfg?.DISCOURSE_URL ?? null,
    wikiBaseUrl: cfg?.WIKI_BASE_URL ?? null,
    wikiApiUrl: cfg?.WIKI_API_URL ?? null,
    costumSlug: (entity?.serverData.slug as string) ?? null,
    hasDiscourse: !!cfg?.DISCOURSE_URL,
    hasWiki: !!cfg?.WIKI_BASE_URL,
  };
}