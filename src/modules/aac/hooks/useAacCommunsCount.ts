/**
 * Combien de communs porte cet AAC — le chiffre du médaillon.
 *
 * Le décompte passe par le mode `countonly` de l'endpoint : aucun document ne
 * traverse le réseau. Il porte sur la population VISIBLE (cf.
 * `fetchAacCommunsCount`), donc sur le même ensemble que l'annuaire — c'est la
 * raison d'être du socle partagé `useAacDirectoryContext`.
 */
import { useQuery } from "@tanstack/react-query";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import { fetchAacCommunsCount } from "../lib/communsTransport";
import { useAacDirectoryContext } from "./useAacDirectoryContext";

export interface UseAacCommunsCountResult {
  /** `null` tant que le chiffre n'est pas connu — jamais un 0 provisoire. */
  count: number | null;
  isLoading: boolean;
  error: Error | null;
}

export function useAacCommunsCount(enabled = true): UseAacCommunsCountResult {
  const { formId, form, fields, resolved, visibility } = useAacDirectoryContext();

  const { data, isLoading, error } = useQuery({
    queryKey: AAC_QUERY_KEYS.COUNT(formId, null, visibility.currentUserId),
    queryFn: () => {
      if (!form) throw new Error("AAC : formulaire non résolu");
      return fetchAacCommunsCount({ form, fields, visibility });
    },
    // ⚠️ On ATTEND la résolution des questions, contrairement au listing.
    // `fields` détermine le garde anti-brouillons (`titre` `$exists`) mais
    // n'entre PAS dans la query key : compter avant résolution figerait dans le
    // cache un total gonflé des brouillons, que rien ne viendrait corriger.
    // Le listing, lui, peut s'en passer — une carte se rend sans le formulaire.
    enabled: enabled && !!formId && !!form && !!resolved,
    staleTime: 5 * 60 * 1000,
  });

  return {
    count: data ?? null,
    isLoading,
    error: (error as Error) ?? null,
  };
}
