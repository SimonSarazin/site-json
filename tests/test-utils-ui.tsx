/**
 * Helpers de test pour les composants UI React.
 *
 * Wrapper minimal qui fournit :
 *  - `LocalizationContext` (nécessaire pour `useT` / `useLocalization`).
 *  - i18next pré-chargé via les bundles modules side-effect.
 *
 * Pour des composants utilisant d'autres providers (`useCocolight`,
 * `QueryClientProvider`, `BrowserRouter`), on ajoutera des helpers dédiés
 * au besoin.
 */
import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { LocalizationContext } from "@/contexts/LocalizationContext";
import type { Locale, LocalizedString } from "@/types/locale-schema";

/**
 * Implémentation minimale de `t()` pour LocalizationContext.
 * Renvoie la valeur du locale courant si présente, sinon le fallback FR.
 */
function makeLocalizationValue(locale: Locale = "fr") {
  return {
    currentLocale: locale,
    setLocale: () => {},
    availableLocales: ["fr", "en"] as const,
    t: (text: LocalizedString, fallback?: string): string => {
      if (typeof text === "string") return text;
      return text[locale] ?? text.fr ?? text.en ?? fallback ?? "";
    },
  };
}

interface RenderUIOptions extends Omit<RenderOptions, "wrapper"> {
  locale?: Locale;
}

/**
 * Render un composant avec `LocalizationContext` pré-rempli.
 * Utiliser pour les composants qui consomment `useT` / `useLocalization`.
 */
export function renderWithProviders(ui: React.ReactElement, options: RenderUIOptions = {}) {
  const { locale = "fr", ...rest } = options;
  const value = makeLocalizationValue(locale);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...rest });
}

// Re-export pour limiter les imports dispersés.
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
