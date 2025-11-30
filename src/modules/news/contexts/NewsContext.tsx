import { createContext, useContext, type ReactNode } from "react";
import type { NewsContextType } from "../types";

/**
 * Context pour le module News
 *
 * Fournit les données et configuration nécessaires aux composants news
 * sans dépendance vers le module profil.
 */

const NewsContext = createContext<NewsContextType | undefined>(undefined);

interface NewsProviderProps {
  children: ReactNode;
  value: NewsContextType;
}

export function NewsProvider({ children, value }: NewsProviderProps) {
  return (
    <NewsContext.Provider value={value}>
      {children}
    </NewsContext.Provider>
  );
}

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