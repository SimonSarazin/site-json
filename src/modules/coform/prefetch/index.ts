import type { QueryClient } from "@tanstack/react-query";
import { COFORM_QUERY_KEYS } from "../constants";
import type { CoFormData } from "../types";

/**
 * Précharge les données d'un formulaire CoForm
 * Utilisé pour le SSR et la navigation optimisée
 */
export async function prefetchCoFormQuery(
  queryClient: QueryClient,
  formId: string,
  fetchFn: () => Promise<CoFormData>
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: COFORM_QUERY_KEYS.FORM(formId),
    queryFn: fetchFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Invalide le cache d'un formulaire
 */
export function invalidateCoFormQuery(
  queryClient: QueryClient,
  formId: string
): void {
  queryClient.invalidateQueries({
    queryKey: COFORM_QUERY_KEYS.FORM(formId),
  });
}

/**
 * Invalide toutes les réponses d'un formulaire
 */
export function invalidateCoFormAnswersQuery(
  queryClient: QueryClient,
  formId: string
): void {
  queryClient.invalidateQueries({
    queryKey: COFORM_QUERY_KEYS.FORM_ANSWERS(formId),
  });
}
