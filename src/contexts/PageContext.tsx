import { Page } from '@/types/site-schema';
import { createContext } from 'react';

interface PageContextType {
  page: Page;
}

export const PageContext = createContext<PageContextType | null>(null);




