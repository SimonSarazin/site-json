import { useTranslation } from "react-i18next";
import { useEffect } from "react";

export function useLoadNamespace(ns: string) {
  const { i18n } = useTranslation();
  const loaded = i18n.hasResourceBundle(i18n.language, ns);

  useEffect(() => {
    if (!loaded) {
      i18n.loadNamespaces(ns);
    }
  }, [loaded, i18n, ns]);

  return { loaded: i18n.hasResourceBundle(i18n.language, ns) };
}