import { useContext } from 'react';
import { CocolightContext } from '../contexts/CocolightContext';

export function useCocolight() {
  const context = useContext(CocolightContext);
  if (!context) {
    throw new Error('useCocolight must be used within a CocolightProvider');
  }
  return context;
}