/**
 * Hook de chargement de la configuration résolue d'un AAC.
 *
 * Zéro nouvel endpoint : `api.form({id})` (form parent) puis, si `form.config`
 * pointe un aapConfig, un 2ᵉ `api.form({id})` pour le doc de config. La
 * normalisation est déléguée à la fonction PURE `resolveAacConfig`.
 *
 * ⚠️ On lit la config org-spécifique (celle pointée par `form.config`), pas le
 * template héritable (cf. plan SOCLE — deux configs Coform coexistent).
 */
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import { resolveAacConfig } from "../lib/resolveAacConfig";
import type { AacResolvedConfig } from "../types";

interface UseAacConfigResult {
  config: AacResolvedConfig | null;
  isLoading: boolean;
  error: Error | null;
}

export function useAacConfig(formId: string | null): UseAacConfigResult {
  const { api, loading } = useCocolight();
  const isReady = !loading && !!api;

  const { data, isLoading, error } = useQuery({
    queryKey: AAC_QUERY_KEYS.CONFIG(formId),
    enabled: isReady && !!formId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AacResolvedConfig> => {
      if (!api || !formId) throw new Error("API non initialisée");

      const form = await api.form({ id: formId });
      const formData = form.serverData as unknown;

      // Charger l'aapConfig (form.config) si présent — best-effort.
      const configId = (formData as { config?: unknown } | null)?.config;
      let configData: unknown;
      if (typeof configId === "string" && configId) {
        try {
          const cfg = await api.form({ id: configId });
          configData = cfg.serverData as unknown;
        } catch {
          configData = undefined;
        }
      }

      return resolveAacConfig(formId, formData, configData);
    },
  });

  return { config: data ?? null, isLoading, error: (error as Error) ?? null };
}
