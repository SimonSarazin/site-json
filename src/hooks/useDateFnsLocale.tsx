import * as dateFnsLocales from 'date-fns/locale';
import { Locale } from 'date-fns';
import { useLocalization } from './useLocalization';

interface Locales {
  [key: string]: Locale;
}

const locales: Locales = {
  fr: dateFnsLocales.fr,
  en: dateFnsLocales.enUS,
  de: dateFnsLocales.de,
  es: dateFnsLocales.es,
};

/**
 * Hook to get the current date-fns locale based on the app's current locale
 * Use this hook in components for date formatting with date-fns
 */
export function useDateFnsLocale(): Locale {
  const { currentLocale } = useLocalization();
  return locales[currentLocale] || dateFnsLocales.enUS;
}
