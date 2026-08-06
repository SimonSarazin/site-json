import { useQuery } from "@tanstack/react-query";
import type { CommunInfo } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { TOOLS_CATALOG_QUERY_KEYS } from "../constants/queryKeys";

interface UseCommunInfoOptions {
  /** `_id` (24hex) de la réponse AAP du commun (item.communId), "" si aucun. */
  communId: string | null | undefined;
  /** Id du form AAP des communs (gate anti-IDOR côté backend, optionnel). */
  communFormId?: string;
  /** Fetch paresseux : true quand la modale est ouverte. */
  enabled?: boolean;
}

/**
 * Fiche « commun » LAZY d'un outil (contact / canal / lien / tags / description).
 * Calqué sur `useToolDetail` — ne fetch qu'à l'ouverture de la modale et seulement
 * si l'outil référence un commun. Passe par l'entité `Answer` (communId = son id).
 */
export function useCommunInfo({ communId, communFormId, enabled = true }: UseCommunInfoOptions) {
  const { api, loading } = useCocolight();
  const id = communId || "";
  // `communFormId` est requis (verrou de périmètre backend) : sans lui, l'appel
  // renverrait toujours `null` → on n'émet pas la requête.
  const isReady = !loading && !!api && !!id && !!communFormId;

  const { data, isPending, error } = useQuery({
    queryKey: TOOLS_CATALOG_QUERY_KEYS.COMMUN_INFO(id || null, communFormId ?? null),
    queryFn: async () => {
      if (!api || !id) throw new Error("communId manquant");
      const answer = await api.answer({ id });
      return answer.getCommunInfo(communFormId ? { formId: communFormId } : {});
    },
    enabled: enabled && isReady,
    staleTime: 5 * 60 * 1000,
  });

  return {
    commun: (data ?? null) as CommunInfo | null,
    // `&& isReady` : en react-query v5 une query désactivée reste `pending`. Sans
    // ça, un site qui active `showCommunInfo` sans `communFormId` afficherait un
    // squelette perpétuel.
    isPending: isPending && isReady,
    error: error as Error | null,
  };
}
