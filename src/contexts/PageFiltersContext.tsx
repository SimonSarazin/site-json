import { createContext, useContext, useState, type ReactNode } from "react";

interface SearchByFieldValue {
  field: string;
  type?: string;
  value: string[] | Record<string, unknown>;
}

interface PageFiltersContextType {
  selectedFilters: Record<string, string[]>;
  setSelectedFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  filterNames: string[];
  searchQuery: string;
  searchByFields: Record<string, SearchByFieldValue>;
  setSearchQuery: (query: string) => void;
  setSearchByFields: React.Dispatch<React.SetStateAction<Record<string, SearchByFieldValue>>>;
  clearFilters: () => void;
}

const PageFiltersContext = createContext<PageFiltersContextType | undefined>(undefined);

export function PageFiltersProvider({ children }: { children: ReactNode }) {
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchByFields, setSearchByFields] = useState<Record<string, SearchByFieldValue>>({});
  // Calculer les noms de filtres à partir des IDs sélectionnés
  const filterNames = Object.values(selectedFilters).flat();

  const clearFilters = () => {
    setSelectedFilters({});
    setSearchQuery("");
    setSearchByFields({});
  };

  return (
    <PageFiltersContext.Provider
      value={{
        selectedFilters,
        setSelectedFilters,
        filterNames,
        searchQuery,
        setSearchQuery,
        searchByFields,
        clearFilters,
        setSearchByFields
      }}
    >
      {children}
    </PageFiltersContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
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
// eslint-disable-next-line react-refresh/only-export-components
export function usePageFiltersOptional() {
  const context = useContext(PageFiltersContext);
  return context || null;
}
