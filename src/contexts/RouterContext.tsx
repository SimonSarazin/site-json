import React, { createContext, useContext } from 'react';
import { useRouter, RouterState } from '@/hooks/useRouter';

const RouterContext = createContext<RouterState | null>(null);

interface RouterProviderProps {
  children: React.ReactNode;
  initialPath?: string;
}

export function RouterProvider({ children, initialPath = "/" }: RouterProviderProps) {
  const router = useRouter(initialPath);

  return (
    <RouterContext.Provider value={router}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouterContext() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouterContext must be used within a RouterProvider');
  }
  return context;
}