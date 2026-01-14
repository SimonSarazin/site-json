import { useContext } from "react";
import { NewsContext } from "../contexts/NewsContext";
import type { NewsContextType } from "../types";

export function useNewsContext(): NewsContextType {
  const context = useContext(NewsContext);
  if (context === undefined) {
    throw new Error("useNewsContext must be used within a NewsProvider");
  }
  return context;
}

/**
 * Hook optionnel qui ne throw pas d'erreur si pas dans un provider
 * Utile pour les composants qui peuvent fonctionner avec/sans contexte
 */
export function useOptionalNewsContext(): NewsContextType | undefined {
  return useContext(NewsContext);
}
