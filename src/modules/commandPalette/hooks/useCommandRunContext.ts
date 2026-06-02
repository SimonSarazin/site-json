import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { useCocolight } from "@/hooks/useCocolight";
import { useLocalization } from "@/hooks/useLocalization";
import type { Locale } from "@/types/locale-schema";
import { useCommandPalette } from "./useCommandPalette";
import type { CommandRunContext } from "../registry/types";

/**
 * Résout le contexte d'exécution passé à `command.perform` : les capacités
 * impératives (navigation, thème, langue, API) que les sources ne peuvent pas
 * obtenir directement (ce sont des fonctions pures).
 */
export function useCommandRunContext(): CommandRunContext {
  const navigate = useNavigate();
  const { me, api } = useCocolight();
  const { theme, setTheme } = useTheme();
  const { currentLocale, setLocale } = useLocalization();
  const { closePalette } = useCommandPalette();

  return useMemo<CommandRunContext>(
    () => ({
      navigate: (to) => navigate(to),
      close: closePalette,
      me,
      api,
      locale: currentLocale,
      theme,
      setTheme: (t) => setTheme(t),
      setLocale: (l) => setLocale(l as Locale),
    }),
    [navigate, closePalette, me, api, currentLocale, theme, setTheme, setLocale]
  );
}
