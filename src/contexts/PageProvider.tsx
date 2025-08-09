import { Page } from "@/types/site-schema";
import { PageContext } from "./PageContext";

interface PageProviderProps {
  children: React.ReactNode;
  page: Page;
}

export function PageProvider({ children, page }: PageProviderProps) {
  return (
    <PageContext.Provider value={{ page }}>
      {children}
    </PageContext.Provider>
  );
}
