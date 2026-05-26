/**
 * Factory pour les mutations CoForm — alignée avec `cagnotte/actions/mutations/core.ts`
 * et `profil/actions/mutations/core.ts`.
 *
 * Pattern : la factory encapsule `useMutationWithToast` + l'invalidation React Query +
 * la résolution du contexte (`api` non-null), et expose une API stable aux composants.
 *
 * @remarks
 * Le contexte minimal pour une mutation CoForm est `{ api, formId, answerId? }`. Les
 * mutations qui modifient une réponse (`useSubmitAnswer`, `useDeleteAnswer`, ...)
 * passent par cette factory ; le pipeline d'upload de `useCoFormFinalMutation` reste
 * pour l'instant dans `hooks/useCoFormQuery.tsx` (Sprint 2 : extraction dédiée).
 */

import type { QueryKey } from "@tanstack/react-query";
import type { Api } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";

/**
 * Contexte commun à toutes les mutations CoForm.
 * Fourni au moment de l'appel du hook par le composant.
 */
export interface CoFormMutationContext {
  api: Api | null;
  formId: string;
  /** ID de la réponse cible (présent pour update/delete, absent pour création). */
  answerId?: string;
}

/**
 * Contexte résolu (api non-null + formId validé) injecté dans `action`.
 */
export interface ResolvedCoFormContext {
  api: Api;
  formId: string;
  answerId?: string;
}

/**
 * Configuration d'une mutation CoForm.
 */
export interface CoFormMutationConfig<TParams, TData = void> {
  /** Action à exécuter — reçoit le contexte résolu et les params dynamiques. */
  action: (ctx: ResolvedCoFormContext, params: TParams) => Promise<TData>;
  /** Clés i18n pour les toasts (relatives au namespace `modules/coform`). */
  i18n: {
    successKey: string;
    errorKey: string;
  };
  /**
   * Calcule les query keys à invalider au succès. Appelée au montage du hook
   * (ne peut pas dépendre des params de la mutation — qui ne sont connus qu'à
   * l'appel de `.mutate()`).
   */
  invalidate?: (ctx: CoFormMutationContext) => QueryKey[];
  /** Paramètres dynamiques pour les messages de succès. */
  getSuccessParams?: (params: TParams, data: TData) => Record<string, string>;
}

/**
 * Erreur levée si le contexte n'est pas exploitable (api null, formId vide).
 * Le message vise à être affiché directement dans un toast d'erreur.
 */
export class CoFormContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoFormContextError";
  }
}

function resolveContextOrThrow(ctx: CoFormMutationContext): ResolvedCoFormContext {
  if (!ctx.api) {
    throw new CoFormContextError("errors.apiUnavailable");
  }
  if (!ctx.formId) {
    throw new CoFormContextError("errors.formIdMissing");
  }
  return {
    api: ctx.api,
    formId: ctx.formId,
    answerId: ctx.answerId,
  };
}

/**
 * Factory pour créer un hook de mutation CoForm avec toasts + invalidation automatique.
 *
 * @example
 * export const useDeleteAnswer = createCoFormMutation<{ formId: string; answerId: string }>({
 *   action: async (ctx, { formId, answerId }) => {
 *     const form = await ctx.api.form({ id: formId });
 *     const answer = await form.answer({ id: answerId });
 *     await answer.delete();
 *   },
 *   i18n: {
 *     successKey: "toasts.answerDeleted",
 *     errorKey: "toasts.answerDeleteFailed",
 *   },
 *   invalidate: (ctx) => [COFORM_QUERY_KEYS.FORM_ANSWERS(ctx.formId)],
 * });
 */
export function createCoFormMutation<TParams = void, TData = void>(
  config: CoFormMutationConfig<TParams, TData>,
) {
  return function useCoFormMutation(ctx: CoFormMutationContext) {
    return useMutationWithToast<TData, TParams>({
      mutationFn: async (params) => {
        const resolved = resolveContextOrThrow(ctx);
        return await config.action(resolved, params);
      },
      namespace: "modules/coform",
      successKey: config.i18n.successKey,
      errorKey: config.i18n.errorKey,
      getSuccessParams: config.getSuccessParams
        ? (data, variables) => config.getSuccessParams!(variables, data)
        : undefined,
      invalidateQueries: config.invalidate ? config.invalidate(ctx) : [],
    });
  };
}
