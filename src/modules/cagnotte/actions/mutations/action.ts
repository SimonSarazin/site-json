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
import type { ActionStatus, Api, Project } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { deleteActionById } from "@/modules/cagnotte/lib/actionMilestonePathUpdates";
import type { ActionUpdateFields } from "@/modules/cagnotte/lib/actionDiffCalculator";
import { parseFrenchDateToIso } from "@/modules/cagnotte/utils/actionDateHelpers";

export interface ActionMutationContext {
  /**
   * Instance Cocolight `Api` — point d'entrée vers les entités SDK et les
   * endpoints (`costumProjectActionRequestNew`, etc.). Disponible dès que
   * `useCocolight()` est résolu (anonyme ou connecté) ; les mutations throw
   * via `resolveContextOrThrow` si null.
   */
  api: Api | null;
  projectId: string;
  /**
   * Entité Cocolight `Project` du projet parent. Requise par toutes les
   * mutations action — elles utilisent l'API entity-oriented `project.action()` :
   *  - `useCreateAction` : `project.action({...})` + `save()` (création atomique)
   *  - `useEditAction` : `project.action({id}).save()` (diff via `action.data.*`)
   *  - `useMarkActionDone` : `action.updateStatus("done")` (endpoint dédié)
   *  - `useCandidateAction` : `action.joinContributor()` (résolution userId backend)
   *  - `useDeleteAction` : `action.delete(reason)` (guard isAuthorOrAdmin)
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
}

/**
 * Hook : ajoute l'utilisateur courant comme contributeur d'une action.
 *
 * Utilise l'API entity-oriented du SDK Cocolight (`action.joinContributor()`)
 * qui résout automatiquement le `userId` côté serveur. Plus besoin de passer
 * `currentUserId` / `currentUserName` (le SDK lit le user connecté).
 */
export const useCandidateAction = createActionMutation<CandidateActionParams>({
  action: async (ctx, params) => {
    if (!ctx.project) {
      throw new ActionContextError("milestone.errors.projectMissing");
    }
    const action = await ctx.project.action({ id: params.actionId });
    await action.joinContributor();
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
 *
 * Utilise l'endpoint dédié `set_status` du SDK Cocolight via `action.updateStatus()` :
 *  - Ajoute une entrée dans `updateStatus[]` (historique des changements).
 *  - Auto-injecte `endDate` côté backend (timestamp de la complétion).
 *  - Status "discuter" force `status=todo` + ajoute tag "discuter" (cas spécial backend).
 *
 * Avantage vs ancien path-update direct : on récupère l'historique de transitions
 * de statut côté backend (utile pour audit/analytics).
 */
export const useMarkActionDone = createActionMutation<MarkActionDoneParams>({
  action: async (ctx, params) => {
    if (!ctx.project) {
      throw new ActionContextError("milestone.errors.projectMissing");
    }
    const action = await ctx.project.action({ id: params.actionId });
    await action.updateStatus("done");
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
 * Hook : supprime une action via `Action.delete(reason?)` du SDK Cocolight (1.0.137+).
 *
 * Guard côté entité : `isAuthorOrAdmin({checkHierarchy: true})` — autorise l'auteur
 * de l'Action OU les admins du projet parent (via la hiérarchie).
 */
export const useDeleteAction = createActionMutation<DeleteActionParams>({
  action: async (ctx, params) => {
    if (!ctx.project) {
      throw new ActionContextError("milestone.errors.projectMissing");
    }
    const action = await ctx.project.action({ id: params.actionId });
    await deleteActionById({ action });
  },
  i18n: {
    successKey: "ActionsSection.toasts.actionDeleted.title",
    errorKey: "ActionsSection.toasts.actionDeleteFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name ?? "" }),
});

export interface EditActionParams {
  actionId: string;
  /**
   * Champs à mettre à jour (filtrés par le call-site pour ne contenir que les diffs
   * via `calculateActionDiff`). Type strict aligné avec ce que produit le diff —
   * pas de dépendance à l'API SDK plate (`UpdatePathValueData`) car on passe par
   * `action.save()` entity-oriented.
   */
  updates: ActionUpdateFields;
  /** Nom utilisé pour les paramètres de toast */
  name?: string;
}

/**
 * Hook : édite les champs d'une action via l'API entity-oriented du SDK.
 *
 * Flow :
 *  1. `ctx.project.action({ id })` charge l'entité Action existante.
 *  2. On assigne les diffs sur `action.data.*` (proxy du SDK qui track les changements).
 *  3. `action.save()` envoie uniquement les champs modifiés au backend (diff fait
 *     par le SDK via `_extractChangedFields`).
 *
 * Conversions et garanties SDK :
 *  - **Dates** : le SDK exige ISO 8601 et throw sinon. On convertit DD/MM/YYYY →
 *    ISO ici (les call-sites passent encore du DD/MM/YYYY via `<DatePickerInput>`).
 *  - **Champs entiers** (`credits`, `min`, `max`) : le SDK rejette les non-entiers
 *    (1.5 → throw `/entier/i`).
 *  - **Diff atomique** : `save()` est no-op si `action.hasChanges()` est faux.
 *  - **Champs read-only** : `parentId`, `parentType` throw si assignés.
 *  - **Champs create-only** : `mentions`, `timeSpent`, `idParentRoom`, `is_contributor`,
 *    `assign`, `urls` throw si assignés en update (cf. SDK CREATE_ONLY_FIELDS).
 *
 * Le call-site (`<ActionEditDialog>`) calcule encore les diffs via `calculateActionDiff`
 * pour éviter d'envoyer au SDK des assignments inutiles. À long terme, on peut
 * supprimer `calculateActionDiff` puisque `action.hasChanges()` fait le même boulot.
 */
export const useEditAction = createActionMutation<EditActionParams>({
  action: async (ctx, params) => {
    if (!ctx.project) {
      throw new ActionContextError("milestone.errors.projectMissing");
    }
    const action = await ctx.project.action({ id: params.actionId });
    const updates = params.updates;

    // Assignment direct sur les champs typés du SDK (le proxy `action.data` track
    // les modifications). Tout est strictement typé grâce à `ActionUpdateFields`.

    if (updates.name !== undefined) action.data.name = updates.name;
    if (updates.credits !== undefined) action.data.credits = updates.credits;
    if (updates.status !== undefined) action.data.status = updates.status;
    if (updates.tags !== undefined) action.data.tags = updates.tags;
    if (updates["links.contributors"] !== undefined) {
      // `calculateActionDiff` produit la clé dotée `"links.contributors"`. Le SDK
      // expose le champ `links` à plat, donc on encapsule l'objet contributors.
      action.data.links = { contributors: updates["links.contributors"] };
    }
    if (updates.startDate !== undefined) {
      const raw = updates.startDate;
      action.data.startDate =
        typeof raw === "string" && raw.trim() ? parseFrenchDateToIso(raw.trim()) : null;
    }
    if (updates.endDate !== undefined) {
      const raw = updates.endDate;
      action.data.endDate =
        typeof raw === "string" && raw.trim() ? parseFrenchDateToIso(raw.trim()) : null;
    }

    await action.save();
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

/**
 * Re-export du type `ActionStatus` du SDK (source de vérité). Le SDK fait un
 * `export type *` depuis `serverDataType/Action.d.ts` au root, donc on peut
 * importer directement sans deep path. Re-exporté ici pour les call-sites du
 * module cagnotte qui n'ont pas à connaître la provenance SDK.
 *
 * Note : côté form, la validation Zod (`actionCreateFormSchema`) restreint à
 * `"todo" | "done"` que l'utilisateur peut sélectionner. Les autres statuts
 * (`closed`, `disabled`, `tracking`, etc.) sont produits par les méthodes
 * dédiées du SDK (`action.cancel()`, `action.archive()`, `action.updateStatus()`).
 */
export type { ActionStatus };

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
