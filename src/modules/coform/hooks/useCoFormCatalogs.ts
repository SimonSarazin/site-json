import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import type { CommonTableCatalogs } from "../types";

interface UseCoFormCatalogsOptions {
  formId: string;
  /** fieldKey de tous les inputs commonTable du formulaire. Si vide → pas de fetch. */
  inputKeys: string[];
  enabled?: boolean;
}

interface UseCoFormCatalogsReturn {
  catalogs: CommonTableCatalogs;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook pour charger en UN seul appel batch les catalogues collaboratifs des
 * inputs commonTable d'un formulaire (criterias agrégées par toutes les
 * réponses + comptage par criteriaId).
 *
 * **Conditionnel** : si `inputKeys` est vide, le hook ne fait aucun appel
 * réseau (`enabled` interne à false). Donc un formulaire sans commonTable
 * ne paie rien.
 */
export function useCoFormCatalogs({
  formId,
  inputKeys,
  enabled = true,
}: UseCoFormCatalogsOptions): UseCoFormCatalogsReturn {
  const { api, loading } = useCocolight();
  const isReady = !loading && !!api;
  const hasInputs = inputKeys.length > 0;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.COMMONTABLE_CATALOG(formId, inputKeys),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");
      // Pattern entity : `Form.getCatalogs()` wrap l'endpoint, sérialise
      // les `inputKeys` (form-urlencoded) et extrait la map de catalogues.
      const form = await api.form({ id: formId });
      const catalogs = await form.getCatalogs({ inputKeys });
      return catalogs as CommonTableCatalogs;
    },
    enabled: enabled && isReady && !!formId && hasInputs,
    staleTime: 2 * 60 * 1000,
  });

  return {
    catalogs: data ?? {},
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
