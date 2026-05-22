import { useState, type ReactNode } from "react";
import {
  PageFiltersContext,
  type SearchByFieldValue,
} from "./PageFiltersContext";

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
        setSearchByFields,
      }}
    >
      {children}
    </PageFiltersContext.Provider>
  );
}
