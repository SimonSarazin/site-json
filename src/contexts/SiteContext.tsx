import { createContext } from 'react';
import { SiteConfig } from '@/types/site';

interface SiteContextType {
  config: SiteConfig;
}

export const SiteContext = createContext<SiteContextType | null>(null);

