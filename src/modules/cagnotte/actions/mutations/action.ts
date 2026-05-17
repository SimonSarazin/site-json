/**
 * Mutations action (sous-tâches d'un milestone) — factory + hooks
 *
 * Pattern aligné avec `milestone.ts`. Les actions vivent dans
 * `projects.actions[]` et sont reliées à un milestone via `milestone.milestoneId`.
 *
 * La factory accepte un `TData` générique en plus de `TParams` pour permettre aux
 * mutations qui ont besoin de retourner une valeur (typiquement `useCreateAction`,
 * qui résout l'id de l'action fraîchement créée) — la majorité des mutations
 * retournent `void` (défaut).
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import type { Api, UpdatePathValueData } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { normalizeUpdatePathValuePayload } from "@/lib/updatePathValue";
import {
  deleteActionById,
  updateProjectActionFields,
} from "@/modules/cagnotte/lib/actionMilestonePathUpdates";
import { parseFrenchDateToIso } from "@/modules/cagnotte/utils/actionDateHelpers";

export interface ActionMutationContext {
  /**
   * Instance Cocolight `Api` — expose `endpointApi.updatePathValue` typé +
   * tous les autres endpoints (`costumProjectActionRequestNew`, etc.).
   * Disponible dès que `useCocolight()` est résolu (anonyme ou connecté) ;
   * les mutations throw via `resolveContextOrThrow` si null.
   */
  api: Api | null;
  projectId: string;
}

export interface ResolvedActionContext {
  api: Api;
  projectId: string;
  /** Exposé pour les actions composites qui ont besoin de refetcher pendant la mutation
   * (ex. `useCreateAction` qui doit résoudre l'id de l'action créée). */
  queryClient: QueryClient;
}

export interface ActionMutationConfig<TParams, TData = void> {
  action: (ctx: ResolvedActionContext, params: TParams) => Promise<TData>;
  i18n: {
    successKey: string;
    errorKey: string;
  };
  /**
   * Calcule les query keys à invalider au succès. Appelée au montage du hook
   * (donc ne peut pas dépendre des params de la mutation — qui ne sont connus
   * qu'à l'appel de `.mutate()`). Par défaut, invalide le préfixe funding-envelope.
   */
  invalidate?: (ctx: ActionMutationContext) => QueryKey[];
  getSuccessParams?: (params: TParams, data: TData) => Record<string, string>;
}

class ActionContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionContextError";
  }
}

function resolveContextOrThrow(
  ctx: ActionMutationContext,
  queryClient: QueryClient,
): ResolvedActionContext {
  if (!ctx.api) {
    throw new ActionContextError("milestone.errors.apiClientUnavailable");
  }
  if (!ctx.projectId) {
    throw new ActionContextError("milestone.errors.projectIdMissing");
  }
  return { api: ctx.api, projectId: ctx.projectId, queryClient };
}

export function createActionMutation<TParams = void, TData = void>(
  config: ActionMutationConfig<TParams, TData>,
) {
  return function useActionMutation(ctx: ActionMutationContext) {
    const queryClient = useQueryClient();
    return useMutationWithToast<TData, TParams>({
      mutationFn: async (params) => {
        const resolved = resolveContextOrThrow(ctx, queryClient);
        return await config.action(resolved, params);
      },
      namespace: "modules/cagnotte",
      successKey: config.i18n.successKey,
      errorKey: config.i18n.errorKey,
      getSuccessParams: config.getSuccessParams
        ? (data, variables) => config.getSuccessParams!(variables, data)
        : undefined,
      invalidateQueries: config.invalidate
        ? config.invalidate(ctx)
        : [CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX()],
    });
  };
}

// =====================================================
// Hooks générés
// =====================================================

export interface CandidateActionParams {
  actionId: string;
  currentUserId: string;
  currentUserName: string;
}

/**
 * Hook : ajoute l'utilisateur courant comme contributeur d'une action.
 */
export const useCandidateAction = createActionMutation<CandidateActionParams>({
  action: async (ctx, params) => {
    await ctx.api.endpointApi.updatePathValue(
      normalizeUpdatePathValuePayload({
        id: params.actionId,
        collection: "actions",
        path: `links.contributors.${params.currentUserId}`,
        value: {
          type: "citoyens",
          isAdmin: true,
          name: params.currentUserName,
        },
      }),
    );
  },
  i18n: {
    successKey: "ActionsSection.toasts.candidateSuccess.title",
    errorKey: "ActionsSection.toasts.candidateFailed.title",
  },
});

export interface MarkActionDoneParams {
  actionId: string;
  /** Nom utilisé pour les paramètres de toast */
  name?: string;
}

/**
 * Hook : marque une action comme terminée (status = done).
 */
export const useMarkActionDone = createActionMutation<MarkActionDoneParams>({
  action: async (ctx, params) => {
    await updateProjectActionFields({
      source: ctx.api,
      projectId: ctx.projectId,
      index: params.actionId,
      fields: { status: "done" },
    });
  },
  i18n: {
    successKey: "ActionsSection.toasts.actionCompleted.title",
    errorKey: "ActionsSection.toasts.actionCompleteFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name ?? "" }),
});

export interface DeleteActionParams {
  actionId: string;
  name?: string;
}

/**
 * Hook : supprime une action.
 */
export const useDeleteAction = createActionMutation<DeleteActionParams>({
  action: async (ctx, params) => {
    await deleteActionById({ source: ctx.api, actionId: params.actionId });
  },
  i18n: {
    successKey: "ActionsSection.toasts.actionDeleted.title",
    errorKey: "ActionsSection.toasts.actionDeleteFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name ?? "" }),
});

export interface EditActionParams {
  actionId: string;
  /** Champs à mettre à jour (filtrés par le call-site pour ne contenir que les diffs) */
  updates: Record<string, UpdatePathValueData["value"]>;
  /** Nom utilisé pour les paramètres de toast */
  name?: string;
}

/**
 * Hook : édite les champs d'une action (avec setType pour les dates ISO).
 * Le call-site est responsable de filtrer `updates` pour ne contenir que les diffs.
 */
export const useEditAction = createActionMutation<EditActionParams>({
  action: async (ctx, params) => {
    await updateProjectActionFields({
      source: ctx.api,
      projectId: ctx.projectId,
      index: params.actionId,
      fields: params.updates,
      setType: [
        { path: "startDate", type: "isoDate" },
        { path: "endDate", type: "isoDate" },
      ],
    });
  },
  i18n: {
    successKey: "ActionsSection.toasts.actionUpdated.title",
    errorKey: "ActionsSection.toasts.actionUpdateFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name ?? "" }),
});

// =====================================================
// Création d'action — mutation composite (endpoint + fallback + résolution ID + metadata)
// =====================================================

import {
  resolveCreatedActionId,
  type ActionStatus,
} from "@/modules/cagnotte/lib/actionIdResolvers";
import type { FundingEnvelopeNormalizedData } from "@/modules/cagnotte/hooks/useFundingEnvelope";

/**
 * Paramètres pour créer une action. Depuis le SDK Cocolight 1.0.127, l'endpoint
 * `costumProjectActionRequestNew` accepte nativement `startDate`, `endDate`, `tags`,
 * `mentions` — pas besoin d'un second appel pour les métadonnées.
 */
export interface CreateActionParams {
  name: string;
  credits: number;
  status: ActionStatus;
  milestoneId: string;
  tags?: string[];
  /**
   * Liste des **usernames** Cocolight des contributeurs à assigner (collection citoyens).
   * Le backend résout `username` → `links.contributors.{userId}` automatiquement. Préférer
   * cette option à `assign` (qui ne prend qu'un seul userId) ou `is_contributor` (qui ajoute
   * juste l'auteur courant). Voir `CostumProjectActionRequestNewData.mentions` côté SDK.
   */
  contributorUsernames?: string[];
  /** Date FR `DD/MM/YYYY` ou `""` — convertie en ISO 8601 avant envoi au SDK. */
  startDate?: string;
  /** Date FR `DD/MM/YYYY` ou `""` — convertie en ISO 8601 avant envoi au SDK. */
  endDate?: string;
}

/**
 * Résultat de la mutation : id de l'action créée. Retourne `""` si la résolution
 * a échoué (l'action est néanmoins créée côté backend — l'appelant peut afficher un
 * toast partiel).
 */
export interface CreateActionResult {
  actionId: string;
}

/**
 * Hook : crée une action via le SDK Cocolight 1.0.127+.
 *
 * Étapes orchestrées par le `mutationFn` :
 *  1. Appel `apiClient.endpointApi.costumProjectActionRequestNew(data)` — **atomique** :
 *     name, status, credits, milestone, dates (ISO 8601), tags, mentions (usernames)
 *     passent tous dans le même payload. Le backend résout `mentions` en
 *     `links.contributors.{userId}` côté serveur (pas de second appel client).
 *  2. `refetchQueries(FUNDING_ENVELOPE_PREFIX)` puis `resolveCreatedActionId` pour
 *     retrouver l'id MongoDB de l'action (l'endpoint ne le renvoie pas — utile
 *     pour le scroll target côté UI).
 *
 * Toast et invalidation finale gérés par `createActionMutation` (factory).
 */
export const useCreateAction = createActionMutation<CreateActionParams, CreateActionResult>({
  action: async (ctx, params): Promise<CreateActionResult> => {
    const startDateIso = params.startDate?.trim()
      ? parseFrenchDateToIso(params.startDate.trim())
      : null;
    const endDateIso = params.endDate?.trim()
      ? parseFrenchDateToIso(params.endDate.trim())
      : null;
    const cleanedUsernames = (params.contributorUsernames ?? [])
      .map((u) => u.trim())
      .filter((u): u is string => u.length > 0);
    const cleanedTags = (params.tags ?? []).filter((tag) => tag && tag.length > 0);

    await ctx.api.endpointApi.costumProjectActionRequestNew({
      name: params.name,
      status: params.status,
      parentId: ctx.projectId,
      parentType: "projects",
      credits: params.credits,
      milestone: { milestoneId: params.milestoneId },
      ...(startDateIso ? { startDate: startDateIso } : {}),
      ...(endDateIso ? { endDate: endDateIso } : {}),
      ...(cleanedTags.length > 0 ? { tags: cleanedTags } : {}),
      ...(cleanedUsernames.length > 0 ? { mentions: cleanedUsernames } : {}),
    });

    // Refetch + résolution de l'actionId — uniquement pour permettre au parent de
    // positionner un scroll target sur la nouvelle action. Si la résolution échoue,
    // on retourne actionId="" (l'action est créée, mais sans highlight).
    await ctx.queryClient.refetchQueries({
      queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX(),
      type: "active",
    });

    let actionId = "";
    try {
      const cachedQueries = ctx.queryClient.getQueriesData<FundingEnvelopeNormalizedData>({
        queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX(),
      });
      for (const [, data] of cachedQueries) {
        if (!data) continue;
        const milestoneRefreshed = data.milestones?.find((m) => m.id === params.milestoneId);
        const candidate = (milestoneRefreshed?.actions ?? []).find(
          (a) =>
            a.name.trim().toLowerCase() === params.name.trim().toLowerCase() &&
            Number(a.credits) === params.credits &&
            a.status === params.status,
        );
        actionId = resolveCreatedActionId({
          rawEnvelope: data.rawEnvelope,
          projectId: ctx.projectId,
          milestoneId: params.milestoneId,
          name: params.name,
          credits: params.credits,
          expectedStatus: params.status,
          fallbackId: candidate?.id,
        });
        if (actionId) break;
      }
    } catch (resolveError) {
      // Échec non-bloquant : l'action est créée, juste pas de scroll target.
      console.warn("[useCreateAction] resolveCreatedActionId failed:", resolveError);
    }

    return { actionId };
  },
  i18n: {
    successKey: "ActionsSection.toasts.actionCreated.title",
    errorKey: "ActionsSection.toasts.actionCreateFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name }),
});

export { ActionContextError };
