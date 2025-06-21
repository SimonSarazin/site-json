import React, { createContext, useContext, useState, useEffect } from 'react';
import { Locale, LOCALES, LocalizedString } from '@/types/site';

interface LocalizationContextType {
  currentLocale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: LocalizedString, fallback?: string) => string;
  availableLocales: readonly Locale[];
}

const LocalizationContext = createContext<LocalizationContextType | null>(null);

interface LocalizationProviderProps {
  children: React.ReactNode;
  defaultLocale?: Locale;
  availableLocales?: Locale[];
}

export function LocalizationProvider({ 
  children, 
  defaultLocale = 'en',
  availableLocales = LOCALES 
}: LocalizationProviderProps) {
  const [currentLocale, setCurrentLocale] = useState<Locale>(defaultLocale);
  const [isClient, setIsClient] = useState(false);

  // Mark when we're on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Only access localStorage on the client
  useEffect(() => {
    if (!isClient) return;
    
    const savedLocale = localStorage.getItem('preferred-locale') as Locale;
    if (savedLocale && availableLocales.includes(savedLocale)) {
      setCurrentLocale(savedLocale);
    }
  }, [isClient, availableLocales]);

  const setLocale = (locale: Locale) => {
    setCurrentLocale(locale);
    if (isClient) {
      localStorage.setItem('preferred-locale', locale);
    }
  };

  const t = (text: LocalizedString, fallback = 'Missing translation'): string => {
    if (!text) return fallback;
    
    // Try current locale first
    if (text[currentLocale]) return text[currentLocale];
    
    // Try default locale
    if (text[defaultLocale]) return text[defaultLocale];
    
    // Try any available locale
    for (const locale of availableLocales) {
      if (text[locale]) return text[locale];
    }
    
    return fallback;
  };

  return (
    <LocalizationContext.Provider value={{
      currentLocale,
      setLocale,
      t,
      availableLocales
    }}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}