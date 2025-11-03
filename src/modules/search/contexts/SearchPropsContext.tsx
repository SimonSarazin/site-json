import { createContext } from 'react';
import { SearchProSectionProps, SearchProStaticSectionProps } from '../schema';

interface SearchPropsContextType {
  props: SearchProSectionProps | SearchProStaticSectionProps;
  inSection: boolean;
}

export const SearchPropsContext = createContext<SearchPropsContextType | null>(null);


