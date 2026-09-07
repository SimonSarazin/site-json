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
import type { MilestoneSyncDocs } from "@/modules/cagnotte/lib/milestoneSyncContext";
import {
  appendAnswerDepense,
  appendProjectMilestone,
} from "@/modules/cagnotte/lib/actionMilestonePathUpdates";
import {
  closeMilestoneWithSync,
  deleteMilestoneWithSync,
  editMilestoneWithSync,
  restoreMilestoneWithSync,
} from "@/modules/cagnotte/lib/milestoneMutationHandlers";

/**
 * Contexte commun à toutes les mutations milestone.
 * Fourni au moment de l'appel du hook (équivalent de l'`entity` dans createEntityMutation).
 */
export interface MilestoneMutationContext {
  api: Api | null;
  rawEnvelope: unknown;
  /**
   * Documents bruts de la ressource (`project.oceco.milestones[]` + `depense[]`),
   * en REPLI de l'enveloppe quand celle-ci ne porte pas la ressource — cas d'un
   * commun déposé sous un autre contexte. Sans lui, éditer / clôturer / supprimer
   * un palier échoue sur `milestone.errors.syncContextMissing`.
   */
  docs?: MilestoneSyncDocs | null;
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
  docs?: MilestoneSyncDocs | null;
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
  if (!ctx.answerId) {
    throw new MilestoneContextError("milestone.errors.answerIdMissing");
  }
  return {
    api: ctx.api,
    rawEnvelope: ctx.rawEnvelope,
    docs: ctx.docs,
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
  answerDepenseIndex?: number;
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
      docs: ctx.docs,
      projectId: ctx.projectId,
      answerId: ctx.answerId,
      milestoneId: params.milestoneId,
      name: params.name,
      description: params.description,
      status: params.status,
      targetAmount: params.targetAmount,
      answerDepenseIndex: params.answerDepenseIndex,
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
  /**
   * Index direct dans `answer.answers.aapStep1.depense[]`, requis pour cibler la
   * dépense côté answer
   */
  answerDepenseIndex?: number;
}

export const useCloseMilestone = createMilestoneMutation<SimpleMilestoneParams>({
  action: async (ctx, params) => {
    await closeMilestoneWithSync({
      source: ctx.api,
      rawEnvelope: ctx.rawEnvelope,
      docs: ctx.docs,
      projectId: ctx.projectId,
      answerId: ctx.answerId,
      milestoneId: params.milestoneId,
      answerDepenseIndex: params.answerDepenseIndex,
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
      docs: ctx.docs,
      projectId: ctx.projectId,
      answerId: ctx.answerId,
      milestoneId: params.milestoneId,
      answerDepenseIndex: params.answerDepenseIndex,
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
      docs: ctx.docs,
      projectId: ctx.projectId,
      answerId: ctx.answerId,
      milestoneId: params.milestoneId,
      answerDepenseIndex: params.answerDepenseIndex,
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
    const answer = await ctx.api.answer({ id: ctx.answerId });

    if (ctx.projectId) {
      const project = await ctx.api.project({ id: ctx.projectId });
      await appendProjectMilestone({
        project,
        milestone: {
          milestoneId: params.milestoneId,
          name: params.name,
          description: params.description,
          status: params.status ?? "open",
        },
      });
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

export { MilestoneContextError };