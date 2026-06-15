import { useContext } from 'react';
import { CocolightContext } from '../contexts/CocolightContext';

export function useCocolight() {
  const context = useContext(CocolightContext);
  if (!context) {
    throw new Error('useCocolight must be used within a CocolightProvider');
  }
  return context;
}

/**
 * Variante tolérante : retourne `null` hors provider (précédent
 * `usePageFiltersOptional`). À réserver aux composants dont la feature se
 * dégrade proprement sans utilisateur/API — ex. SmartCoForm, où l'absence
 * de `me` désactive simplement la persistance du brouillon (et permet de
 * tester le composant sans monter tout le provider).
 */
export function useCocolightOptional() {
  return useContext(CocolightContext);
}