import { Locale, LocalizedString } from '@/types/locale-schema';
import {  createContext } from 'react';

interface LocalizationContextType {
  currentLocale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: LocalizedString, fallback?: string) => string;
  availableLocales: readonly Locale[];
}

export const LocalizationContext = createContext<LocalizationContextType | null>(null);




