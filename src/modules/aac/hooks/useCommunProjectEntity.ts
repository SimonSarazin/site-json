/**
 * L'entité `Project` d'un commun, résolue DÈS QU'ELLE EST CONNUE.
 *
 * Elle sert à trois choses sur la fiche : décider des droits (`isAdmin()` du projet,
 * pas de l'org du site — cf. doc/18 §Pièges n°4), fournir `oceco.milestones[]` au
 * repli de synchronisation des paliers, et porter les mutations d'actions.
 *
 * Les deux blocs de la fiche (« Besoins financiers » et « Suivi des actions ») montent chacun
 * leur controller : passer par React Query leur donne la MÊME instance d'entité, au
 * lieu d'un fetch par bloc et par ouverture de modale.
 *
 * Résolue via `me.project({id})` quand l'utilisateur est connecté : c'est le contexte
 * utilisateur qui fait remonter la membership, donc `isAdmin()`.
 */
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";

export function useCommunProjectEntity(projectId?: string | null): Project | null {
  const { api, me } = useCocolight();
  const normalizedProjectId = String(projectId ?? "").trim();

  const { data } = useQuery({
    queryKey: AAC_QUERY_KEYS.COMMUN_PROJECT(normalizedProjectId || null, me?.id ?? null),
    enabled: !!normalizedProjectId && (!!me || !!api),
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Project | null> => {
      if (!normalizedProjectId) return null;
      try {
        return (me
          ? await me.project({ id: normalizedProjectId })
          : await api!.project({ id: normalizedProjectId })) as Project;
      } catch (error) {
        console.warn("[useCommunProjectEntity] projet du commun non résolu", error);
        return null;
      }
    },
  });

  return data ?? null;
}
