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
import type { Api, Project, UpdatePathValueData } from "@communecter/cocolight-api-client";
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
  /**
   * Entité Cocolight `Project` du projet parent. Requise uniquement pour
   * `useCreateAction` qui utilise l'API entity-oriented `project.action()` +
   * `save()` du SDK (cf. Action.ts du SDK : `parentId` est injecté automatiquement
   * depuis `this.parent.id` et l'`actionId` est peuplé dans `_draftData` après
   * la réponse serveur — plus besoin de résoudre l'id manuellement).
   *
   * Les autres mutations (`useEditAction`, `useDeleteAction`, etc.) passent
   * encore par `endpointApi.updatePathValue` / `deleteElement` et n'utilisent
   * que `api` + `projectId` — `project` peut être `null` pour elles.
   */
  project: Project | null;
}

export interface ResolvedActionContext {
  api: Api;
  projectId: string;
  /**
   * Passthrough de `ActionMutationContext.project`. Les mutations qui en ont
   * besoin (ex. `useCreateAction`) valident la non-nullité en début de leur
   * `action` callback.
   */
  project: Project | null;
  /** Exposé pour les actions composites qui en ont besoin (rétrocompat). */
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
  return {
    api: ctx.api,
    projectId: ctx.projectId,
    project: ctx.project,
    queryClient,
  };
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
      actionId: params.actionId,
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
 *
 * ⚠️ Conversion DD/MM/YYYY → ISO 8601 obligatoire pour `startDate` / `endDate` :
 * le parser PHP backend (`UpdatePathValuedAction::string_set_type`, branche
 * `setType: "isoDate"`) priorise le format `m-d-Y` (US) avant `d-m-Y` (FR).
 * Envoyer `"05/08/2026"` (5 août côté FR) ferait stocker `8 mai` (mois ↔ jour
 * inversés) ; envoyer `"20/05/2026"` (20 mai) ferait un overflow (mois 20 → an+1).
 * On envoie donc de l'ISO 8601, qui tombe sur le fallback `new DateTime()` PHP
 * qui parse correctement. Cohérent avec `useCreateAction` qui fait déjà ça.
 */
export const useEditAction = createActionMutation<EditActionParams>({
  action: async (ctx, params) => {
    const normalizedUpdates: Record<string, UpdatePathValueData["value"]> = { ...params.updates };
    for (const dateField of ["startDate", "endDate"] as const) {
      const raw = normalizedUpdates[dateField];
      if (typeof raw === "string" && raw.trim()) {
        normalizedUpdates[dateField] = parseFrenchDateToIso(raw.trim());
      }
      // Si la valeur est `null` (date vidée par l'utilisateur) → laissé tel quel,
      // le backend `setType: "isoDate"` short-circuit sur valeur vide.
    }

    await updateProjectActionFields({
      source: ctx.api,
      actionId: params.actionId,
      fields: normalizedUpdates,
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
// Création d'action — via project.action() + save() (SDK entity-oriented)
// =====================================================

/** Statut d'une action — repris du SDK `ActionItemNormalized`. */
export type ActionStatus = "todo" | "done";

/**
 * Paramètres pour créer une action. Le SDK Cocolight (`Project.action()` + `Action.save()`)
 * accepte nativement tous ces champs dans un seul payload atomique.
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
 * Résultat de la mutation : id de l'action créée. Avec `project.action()` + `save()`,
 * le SDK peuple `action.id` automatiquement (cf. `Action._add()` : `this._draftData.id =
 * content.id` après la réponse serveur). Retourne `""` uniquement si le SDK n'a pas
 * pu peupler l'id (cas improbable).
 */
export interface CreateActionResult {
  actionId: string;
}

/**
 * Hook : crée une action via l'API entity-oriented du SDK Cocolight.
 *
 * Flow :
 *  1. `ctx.project.action({...})` crée un draft `Action` lié au project parent.
 *  2. `await action.save()` persiste : `parentId` / `parentType` sont injectés automatiquement
 *     depuis l'entité parente, et `action.id` est peuplé via le `content.id` de la réponse
 *     serveur (cf. `Action._add()` SDK).
 *  3. On retourne `action.id` — plus besoin de refetch + parse du cache RQ pour le
 *     résoudre (workaround qui vivait dans `actionIdResolvers.ts`, désormais inutile).
 *
 * Toast et invalidation gérés par `createActionMutation` (factory).
 */
export const useCreateAction = createActionMutation<CreateActionParams, CreateActionResult>({
  action: async (ctx, params): Promise<CreateActionResult> => {
    if (!ctx.project) {
      throw new ActionContextError("milestone.errors.projectMissing");
    }

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

    const action = await ctx.project.action({
      name: params.name,
      status: params.status,
      credits: params.credits,
      milestone: { milestoneId: params.milestoneId },
      ...(startDateIso ? { startDate: startDateIso } : {}),
      ...(endDateIso ? { endDate: endDateIso } : {}),
      ...(cleanedTags.length > 0 ? { tags: cleanedTags } : {}),
      ...(cleanedUsernames.length > 0 ? { mentions: cleanedUsernames } : {}),
    });
    await action.save();

    return { actionId: action.id ?? "" };
  },
  i18n: {
    successKey: "ActionsSection.toasts.actionCreated.title",
    errorKey: "ActionsSection.toasts.actionCreateFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name }),
});

export { ActionContextError };
