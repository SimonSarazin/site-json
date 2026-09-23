import { useQueries } from "@tanstack/react-query";
import type { CoformAnswersSearchData } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { AMPLI_QUERY_KEYS } from "../constants/queryKeys";
import { ampliAnswerFilters } from "../lib/answersQuery";
import type { AmpliModel } from "../types";

export interface AmpliAnswerCount {
  /** Nombre de propositions ; `null` tant qu'il n'est pas connu (ou sans formulaire). */
  count: number | null;
  isLoading: boolean;
}

/**
 * Nombre de propositions de chaque ampli, pour les cartes de `/ampli`.
 *
 * Une requête par ampli, la plus légère possible (`indexStep: 1` : le backend
 * compte tout, ne renvoie qu'une réponse). Filtres de `ampliAnswerFilters`, les
 * MÊMES que la page ampli : la carte et le compteur « Idées soumises » donnent le
 * même chiffre. Le SDK retire `spam` du `count` et en fait la somme dans `total`.
 *
 * Non préchargé au SSR : les compteurs arrivent après l'hydratation, en squelette
 * d'ici là. Un ampli sans formulaire n'interroge rien.
 */
export function useAmpliAnswerCounts(amplis: AmpliModel[]): Record<string, AmpliAnswerCount> {
  const { entity } = useCocolight();

  const results = useQueries({
    queries: amplis.map((ampli) => ({
      queryKey: AMPLI_QUERY_KEYS.ANSWERS_COUNT(ampli.coform ?? "", ampli.path.name),
      enabled: !!entity && ampli.coform !== null,
      staleTime: 60 * 1000,
      queryFn: async () => {
        const params: Partial<CoformAnswersSearchData> = {
          fediverse: false,
          indexMin: 0,
          indexStep: 1,
          count: true,
          searchType: ["answers"],
          countType: ["answers"],
          filters: ampliAnswerFilters(ampli.coform!, ampli.path),
          fields: ["_id"],
        };
        const page = await entity!.coformAnswersSearch(params);
        return typeof page?.count?.total === "number" ? page.count.total : 0;
      },
    })),
  });

  return Object.fromEntries(
    amplis.map((ampli, index) => {
      const result = results[index];
      const count = typeof result?.data === "number" ? result.data : null;
      return [
        ampli.slug,
        {
          count,
          // « Pas encore de chiffre » plutôt que `isLoading` : au SSR la requête
          // ne part pas (`fetchStatus: idle`, donc `isLoading` faux) — le HTML
          // serveur n'aurait rien, puis le client un squelette, puis le chiffre.
          // Ici serveur et 1er rendu client montrent le MÊME squelette. Un échec
          // retire le squelette : la carte n'affiche simplement pas de compteur.
          isLoading: ampli.coform !== null && count === null && !result?.isError,
        },
      ];
    }),
  );
}
