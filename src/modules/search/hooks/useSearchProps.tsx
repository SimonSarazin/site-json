import { useContext } from "react";
import { SearchPropsContext } from "../contexts/SearchPropsContext";

export function useSearchProps() {
  const context = useContext(SearchPropsContext);
  if (!context) {
    throw new Error('useSearchProps must be used within a SearchPropsProvider');
  }
  return context;
}

export function useSearchPropsOptional() {
  return useContext(SearchPropsContext);
}