import type { Api } from "@communecter/cocolight-api-client";
import i18n from "@/i18n";
import {
  deleteAnswerDepenseAtIndex,
  deleteProjectMilestoneAtIndex,
  deleteActionById,
  updateAnswerDepenseFields,
  updateProjectMilestoneFields,
} from '@/modules/cagnotte/lib/actionMilestonePathUpdates';
import {
  asRecord,
  getEntityIdFromUnknown,
  getEnvelopeProjects,
  resolveMilestoneSyncContext,
} from '@/modules/cagnotte/lib/milestoneSyncContext';
import type { FundingMilestoneStatus } from "@/modules/cagnotte/types";

const t = (key: string): string =>
  String(i18n.t(key, { ns: "modules/cagnotte" }));

type UpdateSource = Api | null;

type MilestoneMutationBaseParams = {
  source: UpdateSource;
  rawEnvelope: unknown;
  projectId: string;
  answerId: string;
  milestoneId: string;
  answerDepenseIndex?: number;
};

type EditMilestoneParams = MilestoneMutationBaseParams & {
  name: string;
  description: string;
  status: FundingMilestoneStatus;
  targetAmount: number;
  /**
   * Index direct dans `answer.answers.aapStep1.depense[]`, utilisé pour cibler la
   * dépense quand `milestoneId` est vide
   */
  answerDepenseIndex?: number;
};

type CloseMilestoneParams = MilestoneMutationBaseParams;
type RestoreMilestoneParams = MilestoneMutationBaseParams;

type MilestoneConstraints = {
  actionIds: string[];
  hasFunding: boolean;
  allActionsDone: boolean;
  canClose : boolean;
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const apiMessage =
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ||
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;
  return apiMessage || (error instanceof Error ? error.message : fallback);
}

function requireSource(source: UpdateSource): Api {
  if (!source) {
    throw new Error(t("milestone.errors.apiClientUnavailable"));
  }
  return source;
}

function resolveSyncContextOrThrow(params: MilestoneMutationBaseParams) {
  const syncContext = resolveMilestoneSyncContext({
    rawEnvelope: params.rawEnvelope,
    projectId: params.projectId,
    answerId: params.answerId,
    milestoneId: params.milestoneId,
  });

  if (!syncContext) {
    throw new Error(t("milestone.errors.syncContextMissing"));
  }

  return syncContext;
}

function resolveAnswerDepenseIndex(
  params: MilestoneMutationBaseParams,
  syncContext: { answerDepenseIndex: number | null },
): number | null {
  return typeof params.answerDepenseIndex === 'number' ? params.answerDepenseIndex : syncContext.answerDepenseIndex;
}

function getMilestoneConstraints(
  params: MilestoneMutationBaseParams,
  answerDepenseIndex: number | null,
): MilestoneConstraints {
  const projects = getEnvelopeProjects(params.rawEnvelope);

  for (const projectRow of projects) {
    const projectData = asRecord(projectRow.serverData ?? projectRow);
    const candidateAnswerId = getEntityIdFromUnknown(projectData) || String(projectData.answer ?? '').trim();
    const candidateProjectId =
      String(asRecord(projectData.project).id ?? '').trim() ||
      getEntityIdFromUnknown(projectRow.projectIdObj) ||
      String(projectData.projectId ?? '').trim();

    const matchesAnswer = params.answerId && candidateAnswerId === params.answerId;
    const matchesProject = params.projectId && candidateProjectId === params.projectId;
    if (!matchesAnswer && !matchesProject) continue;

    const actions = Array.isArray(projectData.actions) ? projectData.actions : [];
    const actionsForMilestone = actions.filter((rawAction) => {
      const action = asRecord(rawAction);
      return String(asRecord(action.milestone).milestoneId ?? '').trim() === params.milestoneId;
    });

    const actionIds = actionsForMilestone
      .map((rawAction) => getEntityIdFromUnknown(rawAction))
      .filter((id): id is string => id.trim().length > 0);

    if (actionsForMilestone.length > 0 && actionIds.length !== actionsForMilestone.length) {
      throw new Error(t("milestone.errors.actionIdMissing"));
    }

    const allActionsDone =
      actionsForMilestone.length > 0 &&
      actionsForMilestone.every((rawAction) => String(asRecord(rawAction).status ?? '').trim() === 'done');

    const depensesFromAnswer = asRecord(asRecord(projectData.answers).aapStep1).depense;
    const depenses = Array.isArray(projectData.depenses)
      ? projectData.depenses
      : Array.isArray(depensesFromAnswer)
        ? depensesFromAnswer
        : [];

    const canClose = actionsForMilestone.length === 0 || allActionsDone;

    const depensesForMilestone = params.milestoneId
      ? depenses.filter((rawDepense) => String(asRecord(rawDepense).milestone ?? '').trim() === params.milestoneId)
      : (answerDepenseIndex !== null && depenses[answerDepenseIndex] ? [depenses[answerDepenseIndex]] : []);

    const hasFunding = depensesForMilestone.some((rawDepense) => {
      const financerList = Array.isArray(asRecord(rawDepense).financer) ? (asRecord(rawDepense).financer as unknown[]) : [];
      return financerList.some((rawFinancer) => Number(asRecord(rawFinancer).amount ?? 0) > 0);
    });

    return { actionIds, hasFunding, allActionsDone , canClose };
  }

  return { actionIds: [], hasFunding: false, allActionsDone: false, canClose : false };
}

export async function editMilestoneWithSync(params: EditMilestoneParams): Promise<void> {
  const api = requireSource(params.source);
  const syncContext = resolveSyncContextOrThrow(params);
  const hasProject = Boolean(params.projectId);

  const answerDepenseIndex = resolveAnswerDepenseIndex(params, syncContext);

  if (answerDepenseIndex === null || !params.answerId) {
    throw new Error(t("milestone.errors.incompleteForEdit.missingAnswerSide"));
  }
  if (hasProject && syncContext.projectMilestoneIndex === null) {
    throw new Error(t("milestone.errors.incompleteForEdit.missingProjectSide"));
  }

  const [project, answer] = await Promise.all([
    hasProject ? api.project({ id: params.projectId }) : null,
    api.answer({ id: params.answerId }),
  ]);

  const writes: Promise<unknown>[] = [
    updateAnswerDepenseFields({
      answer,
      index: answerDepenseIndex,
      fields: {
        poste: params.name,
        price: params.targetAmount,
      },
    }),
  ];

  // Log des modifications de montant (`depense.historique[]`) — source
  // observatoire, cf. `AacLog`. Comparé à la valeur AVANT écriture ; pas de
  // log si le montant est inchangé (seuls poste/description ont changé).
  const previousDepenseList = asRecord(asRecord(answer.serverData).answers).aapStep1;
  const previousDepenses = Array.isArray(asRecord(previousDepenseList).depense)
    ? (asRecord(previousDepenseList).depense as unknown[])
    : [];
  const previousPrice = Number(asRecord(previousDepenses[answerDepenseIndex]).price ?? 0);
  const nextPrice = Number(params.targetAmount ?? 0);

  if (previousPrice !== nextPrice) {
    writes.push(
      answer.updateField(
        `answers.aapStep1.depense.${answerDepenseIndex}.historique`,
        { champ: "price", avant: previousPrice, apres: nextPrice, quand: new Date().toISOString() },
        { arrayForm: true },
      ),
    );
  }

  if (hasProject) {
    writes.push(
      updateProjectMilestoneFields({
        project: project!,
        index: syncContext.projectMilestoneIndex as number,
        fields: {
          name: params.name,
          description: params.description,
          status: params.status,
        },
      }),
    );
  }

  await Promise.all(writes);
}

export async function closeMilestoneWithSync(params: CloseMilestoneParams): Promise<void> {
  const api = requireSource(params.source);
  const syncContext = resolveSyncContextOrThrow(params);
  const answerDepenseIndex = resolveAnswerDepenseIndex(params, syncContext);
  const constraints = getMilestoneConstraints(params, answerDepenseIndex);

  const hasProject = Boolean(params.projectId);

  if (hasProject && syncContext.projectMilestoneIndex === null) {
    throw new Error(t("milestone.errors.incompleteForClose.missingProjectSide"));
  }
  if (answerDepenseIndex === null || !params.answerId) {
    throw new Error(t("milestone.errors.incompleteForClose.missingAnswerSide"));
  }

  if (hasProject && !constraints.canClose) {
    throw new Error(t("milestone.errors.cannotCloseWithOpenActions"));
  }

  const [project, answer] = await Promise.all([
    hasProject ? api.project({ id: params.projectId }) : Promise.resolve(null),
    api.answer({ id: params.answerId }),
  ]);

  if (hasProject) {
    await updateProjectMilestoneFields({
      project: project!,
      index: syncContext.projectMilestoneIndex as number,
      fields: {
        status: 'close',
      },
    });
  }

  await updateAnswerDepenseFields({
    answer,
    index: answerDepenseIndex,
    fields: {
      include: false,
    },
  });
}

export async function restoreMilestoneWithSync(params: RestoreMilestoneParams): Promise<void> {
  const api = requireSource(params.source);
  const syncContext = resolveSyncContextOrThrow(params);
  const answerDepenseIndex = resolveAnswerDepenseIndex(params, syncContext);
  const constraints = getMilestoneConstraints(params, answerDepenseIndex);

  const hasProject = Boolean(params.projectId);

  if (hasProject && syncContext.projectMilestoneIndex === null) {
    throw new Error(t("milestone.errors.incompleteForRestore.missingProjectSide"));
  }
  if (answerDepenseIndex === null || !params.answerId) {
    throw new Error(t("milestone.errors.incompleteForRestore.missingAnswerSide"));
  }

  if (hasProject && !constraints.canClose) {
    throw new Error(t("milestone.errors.cannotCloseWithOpenActions"));
  }

  const [project, answer] = await Promise.all([
    hasProject ? api.project({ id: params.projectId }) : Promise.resolve(null),
    api.answer({ id: params.answerId }),
  ]);

  if (hasProject) {
    await updateProjectMilestoneFields({
      project: project!,
      index: syncContext.projectMilestoneIndex as number,
      fields: {
        status: 'open',
      },
    });
  }

  await updateAnswerDepenseFields({
    answer,
    index: answerDepenseIndex,
    fields: {
      include: true,
    },
  });
}

export async function deleteMilestoneWithSync(params: MilestoneMutationBaseParams): Promise<void> {
  const api = requireSource(params.source);
  const syncContext = resolveSyncContextOrThrow(params);
  const answerDepenseIndex = resolveAnswerDepenseIndex(params, syncContext);
  const constraints = getMilestoneConstraints(params, answerDepenseIndex);
  if (constraints.hasFunding) {
    throw new Error(t("milestone.errors.cannotDeleteIfFunded"));
  }

  const hasProject = Boolean(params.projectId);

  if (hasProject && typeof syncContext.projectMilestoneIndex !== 'number') {
    throw new Error(t("milestone.errors.incompleteForDelete.missingProjectSide"));
  }
  if (answerDepenseIndex === null || !params.answerId) {
    throw new Error(t("milestone.errors.incompleteForDelete.missingAnswerSide"));
  }

  const deletions: Promise<unknown>[] = [];

  if (hasProject) {
    const project = await api.project({ id: params.projectId });

    for (const actionId of constraints.actionIds) {
      const action = await project.action({ id: actionId });
      await deleteActionById({ action });
    }

    deletions.push(
      deleteProjectMilestoneAtIndex({
        project,
        index: syncContext.projectMilestoneIndex as number,
      })
    );
  }

  const answer = await api.answer({ id: params.answerId });
  deletions.push(
    deleteAnswerDepenseAtIndex({
      answer,
      index: answerDepenseIndex,
    })
  );

  await Promise.all(deletions);
}
