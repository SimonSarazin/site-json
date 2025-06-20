import React, { createContext, useContext } from 'react';
import { SiteConfig } from '@/types/site';

interface SiteContextType {
  config: SiteConfig;
}

const SiteContext = createContext<SiteContextType | null>(null);

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

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error('useSite must be used within a SiteProvider');
  }
  return context;
}