import { createContext, useContext } from "react";
import type { KanbanClient } from "@/modules/kanban/transport/kanbanClient";
import type { UserProfile } from "@/modules/kanban/types";

/**
 * Session du module kanban : qui est connecté, et par où parler au backend.
 *
 * Les hooks de données de co-kanban lisaient leur session dans un magasin de module
 * (`useAuth`). Dans site-json, la session est celle du site (`useCocolight`), posée une fois
 * par `KanbanSessionProvider` à la racine des pages du module. Les hooks gardent leurs points
 * d'entrée (`useCurrentUserId`, `useKanbanClient`) et se reprennent donc tels quels.
 * Les tests fournissent leur propre valeur (faux transport) sans simuler tout le SDK.
 */
export interface KanbanSession {
  /**
   * La session du site est-elle connue ? Faux au rendu serveur et au premier rendu client.
   * Vrai ensuite : `me` est alors définitif (`useCocolightInit` le résout avant de rendre), et
   * `userId === null` veut dire « visiteur anonyme ».
   */
  hydrated: boolean;
  /** Id du compte connecté, `null` au rendu serveur et au premier rendu client (hydratation). */
  userId: string | null;
  /** Profil de la personne connectée (`sessionProfile`), `null` tant que `userId` l'est. */
  profile: UserProfile | null;
  client: KanbanClient;
}

export const KanbanSessionContext = createContext<KanbanSession | null>(null);

function useKanbanSession(): KanbanSession {
  const session = useContext(KanbanSessionContext);
  if (session === null) {
    throw new Error("Les hooks du module kanban s'utilisent sous <KanbanSessionProvider>.");
  }
  return session;
}

/** Identifiant de l'utilisateur connecté, ou `null` (dimension des query keys). */
export function useCurrentUserId(): string | null {
  return useKanbanSession().userId;
}

/** La session du site est-elle connue (cf. `KanbanSession.hydrated`) ? */
export function useKanbanHydrated(): boolean {
  return useKanbanSession().hydrated;
}

/** Profil de la personne connectée, ou `null`. */
export function useSessionProfile(): UserProfile | null {
  return useKanbanSession().profile;
}

/** Transport kanban de la session. */
export function useKanbanClient(): KanbanClient {
  return useKanbanSession().client;
}
