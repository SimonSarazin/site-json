import { useContext } from "react";
import { PageFiltersContext } from "../contexts/PageFiltersContext";

export function usePageFilters() {
  const context = useContext(PageFiltersContext);
  if (context === undefined) {
    throw new Error("usePageFilters must be used within a PageFiltersProvider");
  }
  return context;
}

/**
 * Version optionnelle du hook qui retourne null si le contexte n'est pas disponible.
 * Utilisé pour les composants qui peuvent fonctionner avec ou sans filtres.
 */
export function usePageFiltersOptional() {
  const context = useContext(PageFiltersContext);
  return context ?? null;
}
