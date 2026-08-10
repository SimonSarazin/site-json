/**
 * Mutations milestone (jalons financiers) — factory + hooks
 *
 * Pattern aligné avec `src/modules/profil/actions/mutations/core.ts` :
 * la factory encapsule `useMutationWithToast` et expose une API stable
 * pour les composants qui pilotent un milestone d'un projet.
 *
 * Inputs du hook généré :
 *   entity = { api, rawEnvelope, projectId, answerId }
 *   params (par appel) = paramètres dynamiques par mutation (ex: milestoneId)
 *
 * Chaque hook retourne un `UseMutationResult` standard React Query
 * avec invalidation automatique de `FUNDING_ENVELOPE_PREFIX`.
 */

import type { QueryKey } from "@tanstack/react-query";
import type { Api } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import type { FundingMilestoneStatus } from "@/modules/cagnotte/types";
import {
  appendAnswerDepense,
  appendProjectMilestone,
  deleteAnswerDepenseAtIndex,
} from "@/modules/cagnotte/lib/actionMilestonePathUpdates";
import {
  closeMilestoneWithSync,
  deleteMilestoneWithSync,
  editMilestoneWithSync,
  restoreMilestoneWithSync,
} from "@/modules/cagnotte/lib/milestoneMutationHandlers";
import { getFormIdFromAnswerData } from "@/modules/cagnotte/hooks/useSaveCagnotteContribution";

/**
 * Contexte commun à toutes les mutations milestone.
 * Fourni au moment de l'appel du hook (équivalent de l'`entity` dans createEntityMutation).
 */
export interface MilestoneMutationContext {
  api: Api | null;
  rawEnvelope: unknown;
  projectId: string;
  answerId: string;
}

/**
 * Configuration d'une mutation milestone.
 */
export interface MilestoneMutationConfig<TParams> {
  /** Action à exécuter — reçoit le contexte résolu et les params dynamiques */
  action: (ctx: ResolvedMilestoneContext, params: TParams) => Promise<void>;
  /** Clés i18n pour les toasts */
  i18n: {
    successKey: string;
    errorKey: string;
  };
  /** Query keys à invalider (par défaut : FUNDING_ENVELOPE_PREFIX) */
  /**
   * Calcule les query keys à invalider au succès. Appelée au montage du hook
   * (donc ne peut pas dépendre des params de la mutation — qui ne sont connus
   * qu'à l'appel de `.mutate()`). Par défaut, invalide le préfixe funding-envelope.
   */
  invalidate?: (ctx: MilestoneMutationContext) => QueryKey[];
  /** Paramètres dynamiques pour les messages */
  getSuccessParams?: (params: TParams) => Record<string, string>;
}

/**
 * Contexte résolu (api non-null + identifiants validés) injecté dans `action`.
 */
export interface ResolvedMilestoneContext {
  api: Api;
  rawEnvelope: unknown;
  projectId: string;
  answerId: string;
}

/**
 * Erreur levée si le contexte n'est pas exploitable (apiClient null, identifiants vides).
 * Le message vise à être affiché directement dans un toast d'erreur.
 */
class MilestoneContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MilestoneContextError";
  }
}

function resolveContextOrThrow(ctx: MilestoneMutationContext): ResolvedMilestoneContext {
  if (!ctx.api) {
    throw new MilestoneContextError("milestone.errors.apiClientUnavailable");
  }
  if (!ctx.projectId) {
    throw new MilestoneContextError("milestone.errors.projectIdMissing");
  }
  if (!ctx.answerId) {
    throw new MilestoneContextError("milestone.errors.answerIdMissing");
  }
  return {
    api: ctx.api,
    rawEnvelope: ctx.rawEnvelope,
    projectId: ctx.projectId,
    answerId: ctx.answerId,
  };
}

/**
 * Factory pour créer un hook de mutation milestone.
 *
 * Le hook retourné prend en argument le `MilestoneMutationContext` (le composant
 * fournit son apiClient, rawEnvelope et identifiants) et retourne un mutation
 * standard React Query (mutate / mutateAsync / isPending / etc.).
 *
 * @example
 * export const useEditMilestone = createMilestoneMutation<EditMilestoneParams>({
 *   action: (ctx, params) => editMilestoneWithSync({ source: ctx.api, ...ctx, ...params }),
 *   i18n: { successKey: "FinanceSection.toasts.updated.title", errorKey: "FinanceSection.toasts.updateFailed.title" },
 *   getSuccessParams: (params) => ({ name: params.name }),
 * });
 */
export function createMilestoneMutation<TParams = void>(config: MilestoneMutationConfig<TParams>) {
  return function useMilestoneMutation(ctx: MilestoneMutationContext) {
    return useMutationWithToast<void, TParams>({
      mutationFn: async (params) => {
        const resolved = resolveContextOrThrow(ctx);
        await config.action(resolved, params);
      },
      namespace: "modules/cagnotte",
      successKey: config.i18n.successKey,
      errorKey: config.i18n.errorKey,
      getSuccessParams: config.getSuccessParams
        ? (_data, variables) => config.getSuccessParams!(variables)
        : undefined,
      invalidateQueries: config.invalidate
        ? config.invalidate(ctx)
        : [CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX()],
    });
  };
}

// =====================================================
// Hooks générés — utilisés par les composants
// =====================================================

/**
 * Params pour éditer un milestone existant.
 */
export interface EditMilestoneParams {
  milestoneId: string;
  name: string;
  description: string;
  status: FundingMilestoneStatus;
  targetAmount: number;
}

/**
 * Hook : édite un milestone (nom, description, statut, montant cible).
 * Sync les deux côtés : `projects.oceco.milestones[]` + `answers.aapStep1.depense[]`.
 */
export const useEditMilestone = createMilestoneMutation<EditMilestoneParams>({
  action: async (ctx, params) => {
    await editMilestoneWithSync({
      source: ctx.api,
      rawEnvelope: ctx.rawEnvelope,
      projectId: ctx.projectId,
      answerId: ctx.answerId,
      milestoneId: params.milestoneId,
      name: params.name,
      description: params.description,
      status: params.status,
      targetAmount: params.targetAmount,
    });
  },
  i18n: {
    successKey: "FinanceSection.toasts.updated.title",
    errorKey: "FinanceSection.toasts.updateFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name }),
});

/**
 * Hook : ferme un milestone (passe en statut `close`, désactive l'include côté answer).
 */
export interface SimpleMilestoneParams {
  milestoneId: string;
  /** Nom utilisé uniquement pour les paramètres de toast (UX) */
  name?: string;
}

export const useCloseMilestone = createMilestoneMutation<SimpleMilestoneParams>({
  action: async (ctx, params) => {
    await closeMilestoneWithSync({
      source: ctx.api,
      rawEnvelope: ctx.rawEnvelope,
      projectId: ctx.projectId,
      answerId: ctx.answerId,
      milestoneId: params.milestoneId,
    });
  },
  i18n: {
    successKey: "FinanceSection.toasts.closed.title",
    errorKey: "FinanceSection.toasts.closeFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name ?? "" }),
});

/**
 * Hook : restaure un milestone clôturé (retour en `open` + include true côté answer).
 */
export const useRestoreMilestone = createMilestoneMutation<SimpleMilestoneParams>({
  action: async (ctx, params) => {
    await restoreMilestoneWithSync({
      source: ctx.api,
      rawEnvelope: ctx.rawEnvelope,
      projectId: ctx.projectId,
      answerId: ctx.answerId,
      milestoneId: params.milestoneId,
    });
  },
  i18n: {
    successKey: "FinanceSection.toasts.restored.title",
    errorKey: "FinanceSection.toasts.restoreFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name ?? "" }),
});

/**
 * Hook : supprime un milestone et ses actions associées (ne supprime pas si financé).
 */
export const useDeleteMilestone = createMilestoneMutation<SimpleMilestoneParams>({
  action: async (ctx, params) => {
    await deleteMilestoneWithSync({
      source: ctx.api,
      rawEnvelope: ctx.rawEnvelope,
      projectId: ctx.projectId,
      answerId: ctx.answerId,
      milestoneId: params.milestoneId,
    });
  },
  i18n: {
    successKey: "FinanceSection.toasts.deleted.title",
    errorKey: "FinanceSection.toasts.deleteFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name ?? "" }),
});

/**
 * Params pour créer un milestone.
 * Composite : appendProjectMilestone + appendAnswerDepense.
 */
export interface CreateMilestoneParams {
  milestoneId: string;
  name: string;
  description: string;
  /** Statut initial (par défaut `open`) */
  status?: "open" | "done";
  /** Montant cible (utilisé pour la dépense côté answer) */
  targetAmount: number;
  /** Utilisateur qui crée le milestone (pour la dépense) */
  userId: string;
}

/**
 * Hook : crée un milestone (côté projet + dépense côté answer).
 */
export const useCreateMilestone = createMilestoneMutation<CreateMilestoneParams>({
  action: async (ctx, params) => {
    const [project, answer] = await Promise.all([
      ctx.api.project({ id: ctx.projectId }),
      ctx.api.answer({ id: ctx.answerId }),
    ]);

    await appendProjectMilestone({
      project,
      milestone: {
        milestoneId: params.milestoneId,
        name: params.name,
        description: params.description,
        status: params.status ?? "open",
      },
    });

    await appendAnswerDepense({
      answer,
      depense: {
        poste: params.name,
        price: params.targetAmount,
        date: new Date().toISOString(),
        user: params.userId,
        milestone: params.milestoneId,
        financer: [],
      },
    });
  },
  i18n: {
    successKey: "CreateMilestoneDialog.toasts.added.title",
    errorKey: "CreateMilestoneDialog.toasts.addFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name }),
});

export { MilestoneContextError };

// =====================================================================
// Mutations "answer-only" — commun pas encore en phase projet (projectId absent)
// =====================================================================
//
// resolveContextOrThrow (ci-dessus) exige projectId pour TOUTES les mutations —
// donc useCreateMilestone/useEditMilestone/useDeleteMilestone échouent
// systématiquement avec `projectIdMissing` tant que le commun n'a pas encore
// été promu en projet. Les trois hooks ci-dessous couvrent le même besoin
// (créer/éditer/supprimer un palier) mais ne touchent QUE
// `answer.answers.aapStep1.depense[]` — jamais `project.milestones[]`
// les actions (qui n'existent pas côté answer). Même pattern que
// useSaveCagnotteContribution.ts : Answer.updateField en premier, repli sur un
// clone + save complet.

export interface AnswerOnlyMilestoneMutationContext {
  api: Api | null;
  answerId: string;
}

interface ResolvedAnswerOnlyContext {
  api: Api;
  answerId: string;
}

function resolveAnswerOnlyContextOrThrow(
  ctx: AnswerOnlyMilestoneMutationContext,
): ResolvedAnswerOnlyContext {
  if (!ctx.api) {
    throw new MilestoneContextError("milestone.errors.apiClientUnavailable");
  }
  if (!ctx.answerId) {
    throw new MilestoneContextError("milestone.errors.answerIdMissing");
  }
  return { api: ctx.api, answerId: ctx.answerId };
}

/** Localise l'index d'une dépense par son `milestone` (id stable), pour cibler un update/delete. */
function findDepenseIndexByMilestoneId(answerData: any, milestoneId: string): number {
  const depenses = answerData?.answers?.aapStep1?.depense;
  const list = Array.isArray(depenses) ? depenses : depenses ? [depenses] : [];
  return list.findIndex((d: any) => String(d?.milestone ?? "") === milestoneId);
}

interface AnswerOnlyMilestoneMutationConfig<TParams> {
  action: (ctx: ResolvedAnswerOnlyContext, params: TParams) => Promise<void>;
  i18n: { successKey: string; errorKey: string };
  getSuccessParams?: (params: TParams) => Record<string, string>;
}

function createAnswerOnlyMilestoneMutation<TParams>(config: AnswerOnlyMilestoneMutationConfig<TParams>) {
  return function useAnswerOnlyMilestoneMutation(ctx: AnswerOnlyMilestoneMutationContext) {
    return useMutationWithToast<void, TParams>({
      mutationFn: async (params) => {
        const resolved = resolveAnswerOnlyContextOrThrow(ctx);
        await config.action(resolved, params);
      },
      namespace: "modules/cagnotte",
      successKey: config.i18n.successKey,
      errorKey: config.i18n.errorKey,
      getSuccessParams: config.getSuccessParams
        ? (_data, variables) => config.getSuccessParams!(variables)
        : undefined,
      invalidateQueries: [CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX()],
    });
  };
}

/**
 * Hook : crée un palier côté answer uniquement (pas de projet à ce stade).
 * Réutilise directement appendAnswerDepense — c'est déjà answer-only par nature,
 * useCreateMilestone ne fait qu'ajouter appendProjectMilestone à côté.
 */
export const useCreateMilestoneAnswerOnly = createAnswerOnlyMilestoneMutation<CreateMilestoneParams>({
  action: async (ctx, params) => {
    const answer = await ctx.api.answer({ id: ctx.answerId });

    // Garde d'idempotence : un double-clic ou un retry réseau rejoue le mutate()
    // avec le même milestoneId — on refuse plutôt que d'ajouter un doublon de palier.
    if (findDepenseIndexByMilestoneId(answer.serverData, params.milestoneId) !== -1) {
      throw new MilestoneContextError("milestone.errors.milestoneAlreadyExists");
    }

    await appendAnswerDepense({
      answer,
      depense: {
        poste: params.name,
        price: params.targetAmount,
        date: new Date().toISOString(),
        user: params.userId,
        milestone: params.milestoneId,
        financer: [],
      },
    });
  },
  i18n: {
    successKey: "CreateMilestoneDialog.toasts.added.title",
    errorKey: "CreateMilestoneDialog.toasts.addFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name }),
});

export interface EditMilestoneAnswerOnlyParams {
  milestoneId: string;
  name: string;
  description: string;
  status: FundingMilestoneStatus;
  targetAmount: number;
}

export const useEditMilestoneAnswerOnly = createAnswerOnlyMilestoneMutation<EditMilestoneAnswerOnlyParams>({
  action: async (ctx, params) => {
    const answer = await ctx.api.answer({ id: ctx.answerId });
    const depenseIndex = findDepenseIndexByMilestoneId(answer.serverData, params.milestoneId);
    if (depenseIndex === -1) {
      throw new MilestoneContextError("milestone.errors.milestoneNotFound");
    }

    const patch = {
      poste: params.name,
      description: params.description,
      priceInt: params.targetAmount,
      // Pas de champ `status` côté answer (cf. useCagnotteAdapter.ts : status dérivé de
      // `include`) — "close" retire l'item de l'affichage, tout le reste = ouvert.
      include: params.status !== "close",
    };

    try {
      await answer.updateField(`answers.aapStep1.depense.${depenseIndex}`, patch, { updatePartial: true });
      return;
    } catch (pathError) {
      console.warn("updateField échoué pour l'édition answer-only du palier, repli sur save() complet...", pathError);
    }

    const currentAnswerData = answer.serverData;
    const cloned = structuredClone
      ? structuredClone(currentAnswerData)
      : JSON.parse(JSON.stringify(currentAnswerData ?? {}));
    const depenses = cloned?.answers?.aapStep1?.depense;
    const list = Array.isArray(depenses) ? depenses : depenses ? [depenses] : [];
    if (!list[depenseIndex]) {
      throw new MilestoneContextError("milestone.errors.milestoneNotFound");
    }
    list[depenseIndex] = { ...list[depenseIndex], ...patch };
    cloned.answers.aapStep1.depense = list;

    const formId = getFormIdFromAnswerData(currentAnswerData);
    if (ctx.api && formId) {
      await ctx.api.endpointApi.saveCoformAnswer({
        formId,
        answerId: answer.id ?? undefined,
        answers: JSON.stringify(cloned.answers ?? {}),
        links: JSON.stringify(cloned.links ?? currentAnswerData.links ?? {}),
      });
      return;
    }
    await answer.save();
  },
  i18n: {
    successKey: "FinanceSection.toasts.updated.title",
    errorKey: "FinanceSection.toasts.updateFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name }),
});

/**
 * Supprime un palier answer-only. Refuse si des financements existent déjà sur ce
 * poste (même garde que deleteMilestoneWithSync, "ne supprime pas si financé") —
 * évite de faire disparaître silencieusement des promesses/paiements déjà enregistrés.
 */
export const useDeleteMilestoneAnswerOnly = createAnswerOnlyMilestoneMutation<SimpleMilestoneParams>({
  action: async (ctx, params) => {
    const answer = await ctx.api.answer({ id: ctx.answerId });
    const currentAnswerData = answer.serverData;
    const depenseIndex = findDepenseIndexByMilestoneId(currentAnswerData, params.milestoneId);
    if (depenseIndex === -1) {
      throw new MilestoneContextError("milestone.errors.milestoneNotFound");
    }

    const depenses = (currentAnswerData as any)?.answers?.aapStep1?.depense;
    const list = Array.isArray(depenses) ? depenses : depenses ? [depenses] : [];
    const target = list[depenseIndex];
    const hasFunding = Array.isArray(target?.financer) && target.financer.length > 0;
    if (hasFunding) {
      throw new MilestoneContextError("milestone.errors.cannotDeleteFunded");
    }

    // Suppression atomique via $pull (même helper que deleteMilestoneWithSync) —
    // évite le clone + save complet, qui peut écraser une écriture concurrente
    // survenue entre la lecture de currentAnswerData et le save().
    await deleteAnswerDepenseAtIndex({ answer, index: depenseIndex });
  },
  i18n: {
    successKey: "FinanceSection.toasts.deleted.title",
    errorKey: "FinanceSection.toasts.deleteFailed.title",
  },
  getSuccessParams: (params) => ({ name: params.name ?? "" }),
});