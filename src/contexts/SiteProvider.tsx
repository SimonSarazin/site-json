import { SiteConfig } from "@/types/site-schema";
import { SiteContext } from "./SiteContext";

interface SiteProviderProps {
  children: React.ReactNode;
  config: SiteConfig;
}

export function SiteProvider({ children, config }: SiteProviderProps) {
  return (
    <SiteContext.Provider value={{ config }}>
      {children}
    </SiteContext.Provider>
  );
}
