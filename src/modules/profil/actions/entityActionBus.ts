/**
 * Bus d'événements d'action d'entité — POINT D'EXTENSION post-succès.
 *
 * `createEntityMutation` émet ici APRÈS l'invalidation react-query (purement
 * ADDITIF : le comportement existant des mutations est inchangé). N'importe quel
 * composant peut s'abonner via `useEntityActionEffect` pour réagir « suivant le
 * besoin » sans toucher au cœur des mutations.
 *
 * Cas d'usage actuel : `PreviewEvent` écoute join/leave/accept/reject sur SON
 * entité et appelle `item.refresh()` — la mutation ne met à jour que `me`, pas
 * le proxy de l'event, donc `refresh()` recharge `links.attendees` et le
 * compteur de participants (abonné via `useReactiveProperty`) se met à jour live.
 */
import { useEffect, useRef } from "react";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";

export type EntityActionType =
  | "follow"
  | "unfollow"
  | "join"
  | "leave"
  | "accept"
  | "reject"
  | "promote";

export interface EntityActionEvent {
  type: EntityActionType;
  entity: EntityTypes;
  me: User | null;
}

type Listener = (event: EntityActionEvent) => void;

const listeners = new Set<Listener>();

/** Émet un événement d'action réussie à tous les abonnés (isole les erreurs de chaque listener). */
export function emitEntityAction(event: EntityActionEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("[entityActionBus] listener error", err);
    }
  }
}

/**
 * S'abonne aux actions d'entité réussies. Le handler est gardé dans une ref →
 * abonnement stable au montage (pas de ré-abonnement à chaque render).
 */
export function useEntityActionEffect(handler: Listener): void {
  const handlerRef = useRef(handler);
  // Maj de la ref dans un effet (pas pendant le render — cf. react-hooks/refs),
  // pour garder le dernier handler sans ré-abonner à chaque render.
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  useEffect(() => {
    const listener: Listener = (event) => handlerRef.current(event);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
