import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useT } from "@/hooks/useT";
import { showSuccessToast, showErrorToast } from "@/lib/toastUtils";

export interface MutationWithToastConfig<TData, TVariables = void> {
  /**
   * Fonction de mutation asynchrone
   */
  mutationFn: (variables: TVariables) => Promise<TData>;

  /**
   * Clé i18n pour le message de succès
   */
  successKey: string;

  /**
   * Clé i18n pour le message d'erreur
   */
  errorKey: string;

  /**
   * Query keys à invalider après succès
   */
  invalidateQueries?: QueryKey[];

  /**
   * Callback appelé après le succès (avant l'invalidation)
   */
  onSuccessCallback?: (data: TData, variables: TVariables) => void;

  /**
   * Fonction pour extraire les paramètres de traduction du message de succès
   */
  getSuccessParams?: (data: TData, variables: TVariables) => Record<string, string>;

  /**
   * Fonction pour extraire les paramètres de traduction du message d'erreur
   */
  getErrorParams?: (error: Error, variables: TVariables) => Record<string, string>;

  /**
   * Namespace i18n (défaut: "common")
   */
  namespace?: string;
}

/**
 * Hook générique pour créer des mutations avec toast de succès/erreur
 *
 * @example
 * // Mutation simple sans variables
 * const followMutation = useMutationWithToast({
 *   mutationFn: () => entity.follow(),
 *   successKey: "toast.relationship.followSuccess",
 *   errorKey: "toast.relationship.followError",
 *   invalidateQueries: [QUERY_KEYS.ELEMENT_ABOUT(entity.slug)],
 *   namespace: "modules/profil",
 * });
 *
 * @example
 * // Mutation avec variables et paramètres dynamiques
 * const promoteMutation = useMutationWithToast<void, User>({
 *   mutationFn: (user) => user.promoteToAdmin(),
 *   successKey: "toast.members.promoteSuccess",
 *   errorKey: "toast.members.promoteError",
 *   getSuccessParams: (_, user) => ({ name: user.serverData?.name || "Unknown" }),
 *   invalidateQueries: [QUERY_KEYS.ORGANIZATION_MEMBERS(entity.slug)],
 *   namespace: "modules/profil",
 * });
 */
export function useMutationWithToast<TData = void, TVariables = void>({
  mutationFn,
  successKey,
  errorKey,
  invalidateQueries = [],
  onSuccessCallback,
  getSuccessParams,
  getErrorParams,
  namespace = "common",
}: MutationWithToastConfig<TData, TVariables>) {
  const queryClient = useQueryClient();
  const t = useT(namespace);

  return useMutation({
    mutationFn,

    onSuccess: (data, variables) => {
      // Callback personnalisé
      onSuccessCallback?.(data, variables);

      // Invalider les queries
      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });

      // Afficher le toast de succès
      const params = getSuccessParams?.(data, variables);
      showSuccessToast(successKey, t, params);
    },

    onError: (error: Error, variables) => {
      const params = getErrorParams?.(error, variables);
      showErrorToast(error, errorKey, t, params);
    },
  });
}

/**
 * Utilitaire pour valider une entité avant mutation
 */
export function validateEntity<TEntity, TValidated extends TEntity>(
  entity: TEntity | null,
  typeCheck: (e: TEntity) => e is TValidated,
  errorMessage: string
): asserts entity is TValidated {
  if (!entity || !typeCheck(entity)) {
    throw new Error(errorMessage);
  }
}

/**
 * Crée une fonction de mutation avec validation d'entité intégrée
 * @param entity - L'entité à valider
 * @param typeCheck - Fonction de type guard
 * @param errorMessage - Message d'erreur si la validation échoue
 * @param action - Action à exécuter si la validation réussit
 */
export function createValidatedMutationFn<TEntity, TValidated extends TEntity, TResult>(
  entity: TEntity | null,
  typeCheck: (e: TEntity) => e is TValidated,
  errorMessage: string,
  action: (entity: TValidated) => Promise<TResult>
): () => Promise<TResult> {
  return async () => {
    validateEntity(entity, typeCheck, errorMessage);
    return action(entity);
  };
}
