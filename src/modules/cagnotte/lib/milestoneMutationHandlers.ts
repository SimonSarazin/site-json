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

type UpdateSource = unknown;

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
    throw new Error('Impossible de localiser ce jalon dans projects/answers.');
  }

  return syncContext;
}

function getMilestoneConstraints(params: MilestoneMutationBaseParams): MilestoneConstraints {
  const projects = getEnvelopeProjects(params.rawEnvelope);

  for (const projectRow of projects) {
    const projectData = asRecord(projectRow._serverData ?? projectRow.serverData ?? projectRow);
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
      throw new Error('Certaines actions du jalon n\'ont pas d\'identifiant valide.');
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

  if (syncContext.projectMilestoneIndex === null || syncContext.answerDepenseIndex === null) {
    throw new Error('Ce jalon est incomplet dans projects/answers et ne peut pas être modifié.');
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

  if (syncContext.projectMilestoneIndex === null || syncContext.answerDepenseIndex === null) {
    throw new Error('Ce jalon est incomplet dans projects/answers et ne peut pas être clôturé.');
  }

  if (!constraints.canClose) {
    throw new Error('Clôture impossible: toutes les actions doivent être terminées.');
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

  if (syncContext.projectMilestoneIndex === null || syncContext.answerDepenseIndex === null) {
    throw new Error('Ce jalon est incomplet dans projects/answers et ne peut pas être restauré.');
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
    throw new Error('Suppression impossible: ce jalon est déjà financé.');
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
    throw new Error('Aucun index valide trouvé pour supprimer ce jalon.');
  }

  await Promise.all(deletions);
}
