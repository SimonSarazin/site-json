import i18n from "@/i18n";
import { I18nextProvider } from "react-i18next";
import { useEffect } from "react";
import { useLocalization } from "@/hooks/useLocalization";

/**
 * Met i18next au même locale que `LocalizationProvider`
 * et fournit le contexte react-i18next à toute l’arborescence.
 */
export function I18nBridge({ children }: { children: React.ReactNode }) {
  const { currentLocale } = useLocalization();

  useEffect(() => {
    if (i18n.language !== currentLocale) {
      i18n.changeLanguage(currentLocale);
    }
  }, [currentLocale]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
