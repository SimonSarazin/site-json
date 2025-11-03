import { SearchProSectionProps, SearchProStaticSectionProps } from "../schema";
import { SearchPropsContext } from "./SearchPropsContext";

interface SearchPropsProviderProps {
  children: React.ReactNode;
  props: SearchProSectionProps | SearchProStaticSectionProps;
  inSection: boolean;
}

export function SearchPropsProvider({ children, props, inSection }: SearchPropsProviderProps) {
  return (
    <SearchPropsContext.Provider value={{ props, inSection }}>
      {children}
    </SearchPropsContext.Provider>
  );
}
