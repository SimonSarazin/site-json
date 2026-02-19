import { createContext } from 'react';
import { SiteConfig } from '@/types/site';

interface SiteContextType {
  config: SiteConfig;
  setConfig: (config: SiteConfig) => void;
}

export const SiteContext = createContext<SiteContextType | null>(null);

