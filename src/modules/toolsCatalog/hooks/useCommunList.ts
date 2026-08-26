import { useQuery } from "@tanstack/react-query";
import type { CommunListItem } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { TOOLS_CATALOG_QUERY_KEYS } from "../constants/queryKeys";

interface UseCommunListOptions {
  /** Id du form AAP des communs (celui de `communFormId`). */
  communFormId: string | undefined;
  /** Fetch paresseux : true seulement quand l'éditeur est ouvert. */
  enabled?: boolean;
}

/**
 * Liste `{ id, title }` des communs — options du select de rattachement
 * outil → commun dans l'éditeur d'enrichissement.
 *
 * Passe par l'ÉLÉMENT PORTEUR du costum (et non par le `Form`) : l'endpoint n'est
 * ouvert qu'aux admins du costum, droit que le serveur résout depuis le `costumSlug`
 * injecté par `_withCostumContext` — lequel exige le slug+id du host. La méthode vit
 * sur `BaseEntity`, le host pouvant être une organisation comme un projet.
 */
export function useCommunList({ communFormId, enabled = true }: UseCommunListOptions) {
  const { entity, loading } = useCocolight();
  const carrier = entity;
  const isReady = !loading && !!carrier && !!communFormId;

  const { data, isPending, error } = useQuery({
    queryKey: TOOLS_CATALOG_QUERY_KEYS.COMMUN_LIST(communFormId ?? null),
    queryFn: async () => {
      if (!carrier || !communFormId) throw new Error("Contexte costum ou form des communs manquant");
      return carrier.getCommunList(communFormId);
    },
    enabled: enabled && isReady,
    // Liste quasi statique (≈300 entrées) : on évite un rechargement à chaque
    // ouverture de l'éditeur.
    staleTime: 10 * 60 * 1000,
  });

  return {
    communs: (data ?? []) as CommunListItem[],
    isPending: isPending && isReady,
    error: error as Error | null,
  };
}
