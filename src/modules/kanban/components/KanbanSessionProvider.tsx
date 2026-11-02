import { useMemo, type ReactNode } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import { KanbanSessionContext, type KanbanSession } from "@/modules/kanban/hooks/useKanbanSession";
import { sessionProfile } from "@/modules/kanban/lib/sessionProfile";
import { createSdkKanbanClient } from "@/modules/kanban/transport/sdkKanbanClient";

/**
 * Pose la session du module (cf. `useKanbanSession`) à partir de celle du site.
 *
 * L'id n'apparaît qu'APRÈS hydratation : au rendu serveur `me` vaut `null`, et un premier rendu
 * client connecté produirait d'autres clés de cache, donc un autre HTML. Les requêtes du
 * module restant désactivées sans utilisateur, le serveur et le premier rendu client affichent
 * le même squelette.
 */
export function KanbanSessionProvider({ children }: { children: ReactNode }) {
  const { me, apiClient } = useCocolight();
  const hydrated = useHydrated();
  const userId = hydrated ? (me?.id ?? null) : null;

  // `useMemo` : le transport et la valeur du contexte gardent leur identité d'un rendu à
  // l'autre. Sans lui, chaque rendu de la page referait rendre tous les consommateurs.
  const client = useMemo(() => createSdkKanbanClient(() => apiClient), [apiClient]);
  const serverData = me?.serverData;
  const session = useMemo<KanbanSession>(
    () => ({ hydrated, userId, profile: sessionProfile(userId, serverData), client }),
    [hydrated, userId, serverData, client],
  );

  return <KanbanSessionContext.Provider value={session}>{children}</KanbanSessionContext.Provider>;
}
