import React, { createContext, useContext } from 'react';
import { type SearchProProps } from '../types';

interface SearchPropsContextType {
  props: SearchProProps;
}

const SearchPropsContext = createContext<SearchPropsContextType | null>(null);

interface SearchPropsProviderProps {
  children: React.ReactNode;
  props: SearchProProps;
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