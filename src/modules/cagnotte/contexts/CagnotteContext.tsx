import { createContext } from "react";

/**
 * Détail attaché à un événement milestone (edit, delete, scroll).
 * `projectId` est optionnel pour permettre aux émetteurs sans contexte projet
 * (ex: un summary sticky) de notifier les receivers qui filtreront ensuite
 * selon le projet sélectionné.
 */
export interface MilestoneEventDetail {
  milestoneId: string;
  projectId?: string;
}

export type MilestoneEventListener = (detail: MilestoneEventDetail) => void;

/**
 * Désabonnement renvoyé par les méthodes `on*` du context.
 */
export type Unsubscribe = () => void;

/**
 * API du context cagnotte — un mini event-bus typé qui remplace les
 * `window.dispatchEvent` / `window.addEventListener` historiques.
 *
 * 3 canaux d'événements (chacun avec son `request` émetteur + son `on` listener) :
 *  - **editMilestoneRequest** : demande d'ouvrir le dialog d'édition d'un milestone.
 *  - **deleteMilestoneRequest** : demande de confirmer/supprimer un milestone.
 *  - **scrollToMilestone** : demande de scroll vers un milestone (création ou clic résumé).
 *
 * Les émetteurs (typiquement les boutons d'un summary ou d'une carte milestone) appellent
 * `requestX(detail)`. Les receivers (typiquement la section "détail" qui héberge les
 * dialogs) souscrivent via `onX(listener)` et reçoivent un `Unsubscribe` à appeler
 * dans le cleanup du `useEffect`.
 *
 * Le bus est encapsulé dans un sub-tree React (le `CagnotteLayout` qui rend le Provider),
 * donc plusieurs CagnotteLayouts sur la même page n'interfèrent pas.
 */
export interface CagnotteContextValue {
  requestEditMilestone: (detail: MilestoneEventDetail) => void;
  requestDeleteMilestone: (detail: MilestoneEventDetail) => void;
  requestScrollToMilestone: (detail: MilestoneEventDetail) => void;

  onEditMilestoneRequest: (listener: MilestoneEventListener) => Unsubscribe;
  onDeleteMilestoneRequest: (listener: MilestoneEventListener) => Unsubscribe;
  onScrollToMilestone: (listener: MilestoneEventListener) => Unsubscribe;
}

export const CagnotteContext = createContext<CagnotteContextValue | null>(null);
