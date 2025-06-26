import { type ReactNode, useState, useEffect } from 'react';
import { Locale, LOCALES, LocalizedString } from '@/types/site';
import { LocalizationContext } from './LocalizationContext';


interface LocalizationProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
  availableLocales?: readonly Locale[] | Locale[];
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
    if (typeof window !== 'undefined') {
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