import { useState, useEffect, useCallback } from "react";
import { SiteConfig } from "@/types/site-schema";
import { SiteContext } from "./SiteContext";

interface SiteProviderProps {
  children: React.ReactNode;
  config: SiteConfig;
}

export function SiteProvider({ children, config: initialConfig }: SiteProviderProps) {
  const [config, setConfig] = useState(initialConfig);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  useEffect(() => {
    const handler = (e: CustomEvent<SiteConfig>) => setConfig(e.detail);
    window.addEventListener('site-config-update', handler as EventListener);
    return () => window.removeEventListener('site-config-update', handler as EventListener);
  }, []);

  const handleSetConfig = useCallback((newConfig: SiteConfig) => {
    setConfig(newConfig);
  }, []);

  return (
    <SiteContext.Provider value={{ config, setConfig: handleSetConfig }}>
      {children}
    </SiteContext.Provider>
  );
}
