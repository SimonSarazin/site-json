import { createContext, useContext } from "react";

/**
 * Contexte **optionnel** fourni par le conteneur qui synchronise le preview dans
 * l'URL (aujourd'hui `SearchListView`). Il permet à `useDropdownFilterNav` de
 * faire UNE seule mutation `setSearchParams` (supprimer `previewParam` + poser le
 * filtre) — deux appels dans le même cycle se voient le même `prev` (React
 * Router) et s'écraseraient. `closeRaw` ferme le drawer SANS retoucher l'URL
 * (évite un 2e `setSearchParams` concurrent).
 *
 * Les autres conteneurs (carte, graphe, observatoire, command palette) ne
 * fournissent PAS ce contexte : leur `onClose` ne touche pas l'URL, donc aucune
 * collision — le hook utilise alors l'`onClose` passé à l'appel.
 */
export interface PreviewNavValue {
  /** Nom du param d'URL du preview à retirer lors d'une navigation par facette. */
  previewParam?: string;
  /** Ferme le preview sans muter l'URL (le hook s'en charge atomiquement). */
  closeRaw?: () => void;
}

export const PreviewNavContext = createContext<PreviewNavValue | null>(null);

export function usePreviewNav(): PreviewNavValue | null {
  return useContext(PreviewNavContext);
}
