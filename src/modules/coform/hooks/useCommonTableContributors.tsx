import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import type { HappinessValue } from "../types";

/**
 * Une contribution individuelle d'un user à une ligne du commonTable.
 * Plusieurs entries possibles pour le même user s'il a déclaré plusieurs
 * solutions au même usage.
 */
export interface CommonTableContributor {
  userId: string;
  userName: string;
  userSlug: string;
  criteriaId: string;
  criteria: string;
  happiness: HappinessValue;
  note: number;
  comment: string;
  fromAnswerId: string;
}

interface UseCommonTableContributorsOptions {
  formId: string | null | undefined;
  /** Clé originale de l'input commonTable (sans préfixe `yesOrNo`). */
  inputKey: string | null | undefined;
  /**
   * IDs des criterias correspondant à la ligne. Une ligne peut agréger
   * plusieurs criteriaId (cf. groupKeyResolver côté React).
   */
  criteriaIds: string[];
  /** Si false, ne lance pas la query (lazy fetch au clic du badge). */
  enabled?: boolean;
}

interface UseCommonTableContributorsReturn {
  contributors: CommonTableContributor[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Charge la liste détaillée des contributeurs pour une ligne d'un commonTable
 * (= un usage). Appelé par `CommonTableContributorsDialog` au clic sur le
 * compteur dans la colonne solution.
 */
export function useCommonTableContributors({
  formId,
  inputKey,
  criteriaIds,
  enabled = true,
}: UseCommonTableContributorsOptions): UseCommonTableContributorsReturn {
  const { api, loading } = useCocolight();
  const isReady =
    !loading && !!api && !!formId && !!inputKey && criteriaIds.length > 0;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COFORM_QUERY_KEYS.COMMONTABLE_CONTRIBUTORS(
      formId ?? null,
      inputKey ?? null,
      criteriaIds,
    ),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");
      const sortedIds = [...criteriaIds].sort();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (api.endpointApi as any).getCoformCommontableContributors({
        formId,
        inputKey,
        // Le contentType est form-urlencoded — l'array doit être stringifié.
        criteriaIds: JSON.stringify(sortedIds),
      });
      const raw = response?.serverData?.data ?? response?.data ?? response;
      const list = Array.isArray(raw?.contributors) ? raw.contributors : [];
      return list as CommonTableContributor[];
    },
    enabled: enabled && isReady,
    // Les contributions évoluent peu — un cache court évite de refetch à
    // chaque réouverture du dialog dans la même session.
    staleTime: 30 * 1000,
  });

  return {
    contributors: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
