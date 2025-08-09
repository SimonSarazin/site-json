import { SearchProSectionProps } from "../schema";
import { SearchPropsContext } from "./SearchPropsContext";

interface SearchPropsProviderProps {
  children: React.ReactNode;
  props: SearchProSectionProps;
  inSection: boolean;
}

export function SearchPropsProvider({ children, props, inSection }: SearchPropsProviderProps) {
  return (
    <SearchPropsContext.Provider value={{ props, inSection }}>
      {children}
    </SearchPropsContext.Provider>
  );
}
