import { createContext } from 'react';
import { SearchProSectionProps } from '../schema';

interface SearchPropsContextType {
  props: SearchProSectionProps;
  inSection: boolean;
}

export const SearchPropsContext = createContext<SearchPropsContextType | null>(null);


