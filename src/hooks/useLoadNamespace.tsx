import { useTranslation } from "react-i18next";
import { useEffect } from "react";

const isServer = typeof window === "undefined";

export function useLoadNamespace(ns: string) {
  const { i18n } = useTranslation();
  const loaded = i18n.hasResourceBundle(i18n.language, ns);

  useEffect(() => {
    if (!loaded) {
      i18n.loadNamespaces(ns);
    }
  }, [loaded, i18n, ns]);

  // En SSR, on considère toujours comme chargé pour éviter le mismatch d'hydration
  // Les traductions manquantes afficheront la clé, ce qui est acceptable
  if (isServer) {
    return { loaded: true };
  }

  return { loaded: i18n.hasResourceBundle(i18n.language, ns) };
}