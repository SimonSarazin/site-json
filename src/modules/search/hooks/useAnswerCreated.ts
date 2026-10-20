import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import type { LocalizedString } from "@/types/locale-schema";

import {
  SEARCH_QUERY_KEYS,
  SEARCH_STAT_COUNT_PREFIX,
  SEARCH_STATIC_LIST_PREFIX,
  SEARCH_STATIC_MAP_PREFIX,
} from "../constants/queryKeys";

/**
 * Après la création d'une answer depuis une liste (`addButton.coform`, ex. « Ajouter un créneau ») :
 *  - re-fetch des listes et cartes `searchProStatic` — `useCoFormFinalMutation` n'invalide que les
 *    caches coform (FORM/FORM_ANSWERS), jamais ceux du module search — et des chiffres des tuiles de
 *    stat, qui comptent ces mêmes réponses (créneaux disponibles…) ;
 *  - et des listes gérées du compte (onglet profil « Structures »), où le créneau doit apparaître ;
 *  - le message `addButton.successMessage`, s'il est configuré : sur un formulaire modéré, le créneau
 *    déposé n'apparaît pas dans la liste publique, et sans message le déposant croirait à un échec.
 */
export function useAnswerCreated(successMessage: LocalizedString | undefined) {
  const queryClient = useQueryClient();
  const { me } = useCocolight();
  const t = useT("modules/search");
  // Valeurs comparées par valeur : `useT` rend une nouvelle fonction à chaque rendu.
  const message = successMessage ? t(successMessage) : null;
  const meId = me?.id ?? null;
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STATIC_LIST_PREFIX) });
    queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STATIC_MAP_PREFIX) });
    queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STAT_COUNT_PREFIX) });
    if (meId) {
      queryClient.invalidateQueries({
        queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_QUERY_KEYS.MANAGED_ANSWERS_PREFIX(meId)),
      });
    }
    if (message) toast.success(message);
  }, [queryClient, meId, message]);
}
