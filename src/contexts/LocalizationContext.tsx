import {  createContext } from 'react';
import { Locale, LocalizedString } from '@/types/site';

interface LocalizationContextType {
  currentLocale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: LocalizedString, fallback?: string) => string;
  availableLocales: readonly Locale[];
}

export const LocalizationContext = createContext<LocalizationContextType | null>(null);




