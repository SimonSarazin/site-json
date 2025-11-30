import { type ReactNode } from "react";
import type { NewsContextType } from "../types";
import { NewsContext } from "./NewsContext";

interface NewsProviderProps {
  children: ReactNode;
  value: NewsContextType;
}

export function NewsProvider({ children, value }: NewsProviderProps) {
  return (
    <NewsContext.Provider value={value}>
      {children}
    </NewsContext.Provider>
  );
}