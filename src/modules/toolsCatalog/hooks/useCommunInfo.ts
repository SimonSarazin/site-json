import { useQuery, useQueryClient } from "@tanstack/react-query";
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
 * si l'outil référence un commun. Passe par `Form.communInfo` (le form AAP + le communId).
 */
export function useCommunInfo({ communId, communFormId, enabled = true }: UseCommunInfoOptions) {
  const { api, loading } = useCocolight();
  const queryClient = useQueryClient();
  const id = communId || "";
  // `communFormId` est requis (verrou de périmètre backend) : sans lui, l'appel
  // renverrait toujours `null` → on n'émet pas la requête.
  const isReady = !loading && !!api && !!id && !!communFormId;

  const { data, isPending, error } = useQuery({
    queryKey: TOOLS_CATALOG_QUERY_KEYS.COMMUN_INFO(id || null, communFormId ?? null),
    queryFn: async () => {
      if (!api || !id || !communFormId) throw new Error("communFormId ou communId manquant");
      // `Form.communInfo` et NON `api.answer({id}).getCommunInfo` : `api.form` ne charge que la
      // définition PUBLIQUE du formulaire, là où `api.answer({id})` déclenchait un `get()`
      // (findanswered, auth none) téléchargeant le doc AAP COMPLET — `financer[]` nominatif inclus —
      // dans le navigateur du visiteur, la fuite exacte que la projection minimale `communinfo`
      // évite. Corrigé côté SDK en 1.0.183 (méthode déplacée Answer → Form).
      // Instance `Form` en cache partagé (cf. FORM_INSTANCE) : la définition du
      // form AAP n'est téléchargée qu'une fois, pas à chaque commun consulté.
      const form = await queryClient.ensureQueryData({
        queryKey: TOOLS_CATALOG_QUERY_KEYS.FORM_INSTANCE(communFormId),
        queryFn: () => api.form({ id: communFormId }),
        staleTime: Infinity,
      });
      return form.communInfo({ communId: id });
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
