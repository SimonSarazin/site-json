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
};

type EditMilestoneParams = MilestoneMutationBaseParams & {
  name: string;
  description: string;
  status: FundingMilestoneStatus;
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
  const api = requireSource(params.source);
  const syncContext = resolveSyncContextOrThrow(params);

  if (syncContext.projectMilestoneIndex === null) {
    throw new Error(t("milestone.errors.incompleteForEdit.missingProjectSide"));
  }
  if (syncContext.answerDepenseIndex === null) {
    throw new Error(t("milestone.errors.incompleteForEdit.missingAnswerSide"));
  }

  const [project, answer] = await Promise.all([
    api.project({ id: params.projectId }),
    api.answer({ id: params.answerId }),
  ]);

  await updateProjectMilestoneFields({
    project,
    index: syncContext.projectMilestoneIndex,
    fields: {
      name: params.name,
      description: params.description,
      status: params.status,
    },
  });

  await updateAnswerDepenseFields({
    answer,
    index: syncContext.answerDepenseIndex,
    fields: {
      poste: params.name,
      price: params.targetAmount,
    },
  });
}

export async function closeMilestoneWithSync(params: CloseMilestoneParams): Promise<void> {
  const api = requireSource(params.source);
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

  const [project, answer] = await Promise.all([
    api.project({ id: params.projectId }),
    api.answer({ id: params.answerId }),
  ]);

  await updateProjectMilestoneFields({
    project,
    index: syncContext.projectMilestoneIndex,
    fields: {
      status: 'close',
    },
  });

  await updateAnswerDepenseFields({
    answer,
    index: syncContext.answerDepenseIndex,
    fields: {
      include: false,
    },
  });
}

export async function restoreMilestoneWithSync(params: RestoreMilestoneParams): Promise<void> {
  const api = requireSource(params.source);
  const syncContext = resolveSyncContextOrThrow(params);

  if (syncContext.projectMilestoneIndex === null) {
    throw new Error(t("milestone.errors.incompleteForRestore.missingProjectSide"));
  }
  if (syncContext.answerDepenseIndex === null) {
    throw new Error(t("milestone.errors.incompleteForRestore.missingAnswerSide"));
  }

  const [project, answer] = await Promise.all([
    api.project({ id: params.projectId }),
    api.answer({ id: params.answerId }),
  ]);

  await updateProjectMilestoneFields({
    project,
    index: syncContext.projectMilestoneIndex,
    fields: {
      status: 'open',
    },
  });

  await updateAnswerDepenseFields({
    answer,
    index: syncContext.answerDepenseIndex,
    fields: {
      include: true,
    },
  });
}

export async function deleteMilestoneWithSync(params: MilestoneMutationBaseParams): Promise<void> {
  const api = requireSource(params.source);
  const syncContext = resolveSyncContextOrThrow(params);
  const constraints = getMilestoneConstraints(params);

  if (constraints.hasFunding) {
    throw new Error(t("milestone.errors.cannotDeleteIfFunded"));
  }

  // Charge le project (utilisé pour résoudre les actions et pull la milestone).
  const project = await api.project({ id: params.projectId });

  for (const actionId of constraints.actionIds) {
    const action = await project.action({ id: actionId });
    await deleteActionById({ action });
  }

  const deletions: Promise<unknown>[] = [];
  if (typeof syncContext.projectMilestoneIndex === 'number') {
    deletions.push(
      deleteProjectMilestoneAtIndex({
        project,
        index: syncContext.projectMilestoneIndex,
      })
    );
  }

  if (typeof syncContext.answerDepenseIndex === 'number' && params.answerId) {
    // Charge l'answer en parallèle uniquement si on a une dépense à pull.
    const answer = await api.answer({ id: params.answerId });
    deletions.push(
      deleteAnswerDepenseAtIndex({
        answer,
        index: syncContext.answerDepenseIndex,
      })
    );
  }

  if (deletions.length === 0) {
    throw new Error(t("milestone.errors.noIndexForDelete"));
  }

  await Promise.all(deletions);
}
