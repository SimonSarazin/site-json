import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ToolUser } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { TOOLS_CATALOG_QUERY_KEYS } from "../constants/queryKeys";

interface UseToolDetailOptions {
  formId: string | null | undefined;
  step: string | null | undefined;
  finderPath: string | null | undefined;
  /** criteriaIds de l'outil (tous suffixes). */
  criteriaIds: string[];
  /** Suffixes yesOrNo où l'outil apparaît (restreint la projection). */
  inputKeys?: string[];
  /** Fetch paresseux : true quand la modale est ouverte. */
  enabled?: boolean;
}

/**
 * Détail LAZY d'un outil : les lieux/CAEs qui l'utilisent (+ satisfaction, note).
 * Calqué sur `useCommonTableContributors` — ne fetch qu'à l'ouverture de la modale.
 */
export function useToolDetail({
  formId,
  step,
  finderPath,
  criteriaIds,
  inputKeys,
  enabled = true,
}: UseToolDetailOptions) {
  const { api, loading } = useCocolight();
  const queryClient = useQueryClient();
  const isReady = !loading && !!api && !!formId && !!step && !!finderPath && criteriaIds.length > 0;

  const { data, isPending, error } = useQuery({
    queryKey: TOOLS_CATALOG_QUERY_KEYS.TOOL_USERS(
      formId ?? null,
      step ?? null,
      finderPath ?? null,
      criteriaIds,
      inputKeys ?? [],
    ),
    queryFn: async () => {
      if (!api || !formId || !step || !finderPath) {
        throw new Error("Paramètres du détail d'outil incomplets");
      }
      // Instance `Form` partagée avec `useToolsCatalog` (cf. FORM_INSTANCE) : évite
      // de re-télécharger le document complet à chaque ouverture de détail.
      const form = await queryClient.ensureQueryData({
        queryKey: TOOLS_CATALOG_QUERY_KEYS.FORM_INSTANCE(formId),
        queryFn: () => api.form({ id: formId }),
        staleTime: Infinity,
      });
      return form.getToolUsers({ step, finderPath, criteriaIds, inputKeys });
    },
    enabled: enabled && isReady,
    staleTime: 30 * 1000,
  });

  return {
    users: (data ?? []) as ToolUser[],
    // `isPending` (et non `isLoading`) : reste vrai tant que la query n'a pas de
    // donnée — évite d'afficher l'état « vide » avant le 1er fetch réel.
    isPending,
    error: error as Error | null,
  };
}
