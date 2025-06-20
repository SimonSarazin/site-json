import { createContext, useContext } from 'react';

export const CocolightContext = createContext(null);

export function useCocolight() {
  const context = useContext(CocolightContext);
  if (!context) {
    throw new Error('useCocolight must be used within a CocolightProvider');
  }
  return context;
}