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

const t = (key: string): string =>
  String(i18n.t(key, { ns: "modules/cagnotte" }));

type UpdateSource = Api | null;

type MilestoneMutationBaseParams = {
  source: UpdateSource;
  rawEnvelope: unknown;
  projectId: string;
  answerId: string;
  milestoneId: string;
};

type EditMilestoneParams = MilestoneMutationBaseParams & {
  name: string;
  description: string;
  status: 'open' | 'done' | 'close';
  targetAmount: number;
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

function getMilestoneConstraints(params: MilestoneMutationBaseParams): MilestoneConstraints {
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

    const depensesForMilestone = depenses.filter(
      (rawDepense) => String(asRecord(rawDepense).milestone ?? '').trim() === params.milestoneId
    );

    const hasFunding = depensesForMilestone.some((rawDepense) => {
      const financerList = Array.isArray(asRecord(rawDepense).financer) ? (asRecord(rawDepense).financer as unknown[]) : [];
      return financerList.some((rawFinancer) => Number(asRecord(rawFinancer).amount ?? 0) > 0);
    });

    return { actionIds, hasFunding, allActionsDone , canClose };
  }

  return { actionIds: [], hasFunding: false, allActionsDone: false, canClose : false };
}

export async function editMilestoneWithSync(params: EditMilestoneParams): Promise<void> {
  const syncContext = resolveSyncContextOrThrow(params);

  if (syncContext.projectMilestoneIndex === null) {
    throw new Error(t("milestone.errors.incompleteForEdit.missingProjectSide"));
  }
  if (syncContext.answerDepenseIndex === null) {
    throw new Error(t("milestone.errors.incompleteForEdit.missingAnswerSide"));
  }

  await updateProjectMilestoneFields({
    source: params.source,
    projectId: params.projectId,
    index: syncContext.projectMilestoneIndex,
    fields: {
      name: params.name,
      description: params.description,
      status: params.status,
    },
  });

  await updateAnswerDepenseFields({
    source: params.source,
    answerId: params.answerId,
    index: syncContext.answerDepenseIndex,
    fields: {
      poste: params.name,
      price: params.targetAmount,
    },
  });
}

export async function closeMilestoneWithSync(params: CloseMilestoneParams): Promise<void> {
  const syncContext = resolveSyncContextOrThrow(params);
  const constraints = getMilestoneConstraints(params);

  if (syncContext.projectMilestoneIndex === null) {
    throw new Error(t("milestone.errors.incompleteForClose.missingProjectSide"));
  }
  if (syncContext.answerDepenseIndex === null) {
    throw new Error(t("milestone.errors.incompleteForClose.missingAnswerSide"));
  }

  if (!constraints.canClose) {
    throw new Error(t("milestone.errors.cannotCloseWithOpenActions"));
  }

  await updateProjectMilestoneFields({
    source: params.source,
    projectId: params.projectId,
    index: syncContext.projectMilestoneIndex,
    fields: {
      status: 'close',
    },
  });

  await updateAnswerDepenseFields({
    source: params.source,
    answerId: params.answerId,
    index: syncContext.answerDepenseIndex,
    fields: {
      include: false,
    },
  });
}

export async function restoreMilestoneWithSync(params: RestoreMilestoneParams): Promise<void> {
  const syncContext = resolveSyncContextOrThrow(params);

  if (syncContext.projectMilestoneIndex === null) {
    throw new Error(t("milestone.errors.incompleteForRestore.missingProjectSide"));
  }
  if (syncContext.answerDepenseIndex === null) {
    throw new Error(t("milestone.errors.incompleteForRestore.missingAnswerSide"));
  }

  await updateProjectMilestoneFields({
    source: params.source,
    projectId: params.projectId,
    index: syncContext.projectMilestoneIndex,
    fields: {
      status: 'open',
    },
  });

  await updateAnswerDepenseFields({
    source: params.source,
    answerId: params.answerId,
    index: syncContext.answerDepenseIndex,
    fields: {
      include: true,
    },
  });
}

export async function deleteMilestoneWithSync(params: MilestoneMutationBaseParams): Promise<void> {
  const syncContext = resolveSyncContextOrThrow(params);
  const constraints = getMilestoneConstraints(params);

  if (constraints.hasFunding) {
    throw new Error(t("milestone.errors.cannotDeleteIfFunded"));
  }

  for (const actionId of constraints.actionIds) {
    await deleteActionById({ source: params.source, actionId });
  }

  const deletions: Promise<unknown>[] = [];
  if (typeof syncContext.projectMilestoneIndex === 'number') {
    deletions.push(
      deleteProjectMilestoneAtIndex({
        source: params.source,
        projectId: params.projectId,
        index: syncContext.projectMilestoneIndex,
      })
    );
  }

  if (typeof syncContext.answerDepenseIndex === 'number' && params.answerId) {
    deletions.push(
      deleteAnswerDepenseAtIndex({
        source: params.source,
        answerId: params.answerId,
        index: syncContext.answerDepenseIndex,
      })
    );
  }

  if (deletions.length === 0) {
    throw new Error(t("milestone.errors.noIndexForDelete"));
  }

  await Promise.all(deletions);
}
