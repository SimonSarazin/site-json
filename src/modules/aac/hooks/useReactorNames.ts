import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "@/modules/coform/constants/queryKeys";
import { fetchElementSummary } from "@/modules/coform/hooks/useElementSummary";

const REACTOR_NAMES_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Résout les noms d'une liste d'ids citoyens dont la réaction ne porte pas de
 * nom elle-même (`links.contributors` et `vote` n'écrivent que
 * `{type}`/`{status,date}` — contrairement à `links.tls`, cf. `buildReactionEntry`
 * dans `useCommunReactions`). Même cache que `useElementSummary`/`useFinderElementImages`
 * (`COFORM_QUERY_KEYS.ELEMENT_SUMMARY`), donc un citoyen déjà résolu ailleurs
 * dans la page ne redéclenche pas de requête.
 *
 * `enabled` sert à ne fetcher qu'au survol (tooltip), pas au montage.
 */
export function useReactorNames(ids: string[], enabled: boolean): { names: string[]; isLoading: boolean } {
  const { api } = useCocolight();

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: COFORM_QUERY_KEYS.ELEMENT_SUMMARY("citoyens", id),
      enabled: enabled && !!api && !!id,
      staleTime: REACTOR_NAMES_STALE_TIME_MS,
      queryFn: () => fetchElementSummary(api!, id, "citoyens"),
    })),
  });

  return useMemo(() => {
    const names = results
      .map((r) => r.data?.name)
      .filter((name): name is string => !!name);
    return { names, isLoading: enabled && results.some((r) => r.isLoading) };
    // `results` change d'identité à chaque render (tableau React Query) — dep
    // volontaire, le recompute est trivial (boucle sur quelques réactions).
  }, [results, enabled]);
}
