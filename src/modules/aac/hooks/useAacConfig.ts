/**
 * Hook de chargement de la configuration résolue d'un AAC.
 *
 * Zéro nouvel endpoint : `entity.form({id})` (form parent) puis, si `form.config`
 * pointe un aapConfig, un 2ᵉ `api.form({id})` pour le doc de config. La
 * normalisation est déléguée à la fonction PURE `resolveAacConfig`.
 *
 * ⚠️ On lit la config org-spécifique (celle pointée par `form.config`), pas le
 * template héritable (cf. plan SOCLE — deux configs Coform coexistent).
 *
 * La requête elle-même vit dans `aacConfigQuery` : elle est partagée avec
 * `useAacFormMeta`, qui lit une autre vue du même document sans second appel.
 */
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { aacConfigQueryOptions, selectAacConfig } from "./aacConfigQuery";
import type { AacResolvedConfig } from "../types";

interface UseAacConfigResult {
  config: AacResolvedConfig | null;
  isLoading: boolean;
  error: Error | null;
  /**
   * Rejoue `entity.form({id})` — la seule reprise possible après un échec de
   * résolution : tout le reste (annuaire, décompte, fiche) en dépend, et rien
   * d'autre ne relancera cette requête, dont les consommateurs sont désactivés
   * tant qu'elle n'a pas abouti.
   */
  refetch: () => Promise<unknown>;
}

export function useAacConfig(formId: string | null): UseAacConfigResult {
  const { api, entity, loading, me } = useCocolight();

  const { data, isLoading, error, refetch } = useQuery({
    ...aacConfigQueryOptions(loading ? null : api, entity, formId, me?.id ?? null),
    select: selectAacConfig,
  });

  return { config: data ?? null, isLoading, error: (error as Error) ?? null, refetch };
}
