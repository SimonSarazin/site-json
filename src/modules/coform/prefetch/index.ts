import type { QueryClient } from "@tanstack/react-query";
import { COFORM_QUERY_KEYS } from "../constants";

/**
 * Précharge les données d'un formulaire CoForm
 * Utilisé pour le SSR et la navigation optimisée
 */
export async function prefetchCoFormQuery(
  queryClient: QueryClient,
  formId: string,
  fetchFn: () => Promise<any>
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: COFORM_QUERY_KEYS.form(formId),
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
    queryKey: COFORM_QUERY_KEYS.form(formId),
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
    queryKey: COFORM_QUERY_KEYS.formAnswers(formId),
  });
}
