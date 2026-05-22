import { createContext } from "react";

export interface SearchByFieldValue {
  field: string;
  type?: string;
  value: string[] | Record<string, unknown>;
}

export interface PageFiltersContextType {
  selectedFilters: Record<string, string[]>;
  setSelectedFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  filterNames: string[];
  searchQuery: string;
  searchByFields: Record<string, SearchByFieldValue>;
  setSearchQuery: (query: string) => void;
  setSearchByFields: React.Dispatch<React.SetStateAction<Record<string, SearchByFieldValue>>>;
  clearFilters: () => void;
}

export const PageFiltersContext = createContext<PageFiltersContextType | undefined>(undefined);
