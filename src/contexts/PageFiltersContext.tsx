import { createContext, useContext, useState, type ReactNode } from "react";

interface PageFiltersContextType {
  selectedFilters: Record<string, string[]>;
  setSelectedFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  filterNames: string[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
}

const PageFiltersContext = createContext<PageFiltersContextType | undefined>(undefined);

export function PageFiltersProvider({ children }: { children: ReactNode }) {
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Calculer les noms de filtres à partir des IDs sélectionnés
  const filterNames = Object.values(selectedFilters).flat();

  const clearFilters = () => {
    setSelectedFilters({});
    setSearchQuery("");
  };

  return (
    <PageFiltersContext.Provider
      value={{
        selectedFilters,
        setSelectedFilters,
        filterNames,
        searchQuery,
        setSearchQuery,
        clearFilters
      }}
    >
      {children}
    </PageFiltersContext.Provider>
  );
}

export function usePageFilters() {
  const context = useContext(PageFiltersContext);
  if (context === undefined) {
    throw new Error("usePageFilters must be used within a PageFiltersProvider");
  }
  return context;
}

/**
 * Version optionnelle du hook qui retourne null si le contexte n'est pas disponible
 * Utilisé pour les composants qui peuvent fonctionner avec ou sans filtres
 */
export function usePageFiltersOptional() {
  const context = useContext(PageFiltersContext);
  return context || null;
}
