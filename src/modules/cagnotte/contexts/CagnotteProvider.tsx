import { useMemo, useRef, type ReactNode } from "react";
import {
  CagnotteContext,
  type CagnotteContextValue,
  type MilestoneEventDetail,
  type MilestoneEventListener,
  type Unsubscribe,
} from "./CagnotteContext";

interface CagnotteProviderProps {
  children: ReactNode;
}

/**
 * Provider du context cagnotte. Encapsule un mini event-bus instancié 1 fois
 * par Provider (via `useRef`) — pas de Set partagé globalement, donc plusieurs
 * `CagnotteLayout` sur la même page restent isolés.
 *
 * Cleanup automatique : le bus est garbage-collected avec le Provider.
 */
export function CagnotteProvider({ children }: CagnotteProviderProps) {
  // 3 Sets de listeners, un par canal. `useRef` garantit la stabilité
  // d'identité entre rendus → les méthodes du context restent stables aussi
  // (cf. useMemo plus bas).
  const editListenersRef = useRef<Set<MilestoneEventListener>>(new Set());
  const deleteListenersRef = useRef<Set<MilestoneEventListener>>(new Set());
  const scrollListenersRef = useRef<Set<MilestoneEventListener>>(new Set());

  const value = useMemo<CagnotteContextValue>(() => {
    const emit = (
      listeners: React.MutableRefObject<Set<MilestoneEventListener>>,
      detail: MilestoneEventDetail
    ): void => {
      if (!detail.milestoneId) return;
      // Snapshot pour permettre à un listener de se désabonner pendant l'émission
      // sans casser l'itération.
      const snapshot = Array.from(listeners.current);
      for (const listener of snapshot) {
        try {
          listener(detail);
        } catch (err) {
          // Un listener qui throw ne doit pas casser la chaîne
          console.error("[CagnotteContext] listener error:", err);
        }
      }
    };

    const subscribe = (
      listeners: React.MutableRefObject<Set<MilestoneEventListener>>,
      listener: MilestoneEventListener
    ): Unsubscribe => {
      listeners.current.add(listener);
      return () => {
        listeners.current.delete(listener);
      };
    };

    return {
      requestEditMilestone: (detail) => emit(editListenersRef, detail),
      requestDeleteMilestone: (detail) => emit(deleteListenersRef, detail),
      requestScrollToMilestone: (detail) => emit(scrollListenersRef, detail),

      onEditMilestoneRequest: (listener) => subscribe(editListenersRef, listener),
      onDeleteMilestoneRequest: (listener) => subscribe(deleteListenersRef, listener),
      onScrollToMilestone: (listener) => subscribe(scrollListenersRef, listener),
    };
  }, []);

  return <CagnotteContext.Provider value={value}>{children}</CagnotteContext.Provider>;
}
