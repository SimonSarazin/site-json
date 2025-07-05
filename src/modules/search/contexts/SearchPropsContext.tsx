import React, { createContext, useContext } from 'react';
import { SearchProSectionProps } from '../schema';


interface SearchPropsContextType {
  props: SearchProSectionProps;
}

const SearchPropsContext = createContext<SearchPropsContextType | null>(null);

interface SearchPropsProviderProps {
  children: React.ReactNode;
  props: SearchProSectionProps;
}

export function SearchPropsProvider({ children, props }: SearchPropsProviderProps) {
  return (
    <SearchPropsContext.Provider value={{ props }}>
      {children}
    </SearchPropsContext.Provider>
  );
}

export function useSearchProps() {
  const context = useContext(SearchPropsContext);
  if (!context) {
    throw new Error('useSearchProps must be used within a SearchPropsProvider');
  }
  return context;
}