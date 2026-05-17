import {
  asRecord,
  getEntityId as sharedGetEntityId,
  getServerData,
  type UnknownRecord,
} from '@/modules/cagnotte/utils/dataTransform';

export type { UnknownRecord };
export { asRecord };

export type MilestoneSyncContext = {
  projectMilestoneIndex: number | null;
  answerDepenseIndex: number | null;
  description: string;
};

/**
 * Alias historique conservé pour compat. `getEntityId` (utils/dataTransform) couvre
 * exactement le même contrat. Utilise directement `getEntityId` dans le nouveau code.
 */
export const getEntityIdFromUnknown = sharedGetEntityId;

export function getEnvelopeProjects(rawEnvelope: unknown): Array<UnknownRecord> {
  const envelopeRecord = asRecord(rawEnvelope);
  const projects = envelopeRecord.projects;
  if (Array.isArray(projects)) return projects.map((item) => asRecord(item));
  return Object.values(asRecord(projects)).map((item) => asRecord(item));
}

export function resolveMilestoneSyncContext(params: {
  rawEnvelope: unknown;
  projectId: string;
  answerId: string;
  milestoneId: string;
}): MilestoneSyncContext | null {
  const projects = getEnvelopeProjects(params.rawEnvelope);

  for (const projectRow of projects) {
    const projectData = asRecord(projectRow.serverData ?? projectRow);
    const projectEntityData = getServerData(projectData.project);
    const candidateAnswerId = getEntityIdFromUnknown(projectData) || String(projectData.answer ?? '').trim();
    const candidateProjectId =
      String(projectEntityData.id ?? '').trim() ||
      getEntityIdFromUnknown(projectRow.projectIdObj) ||
      String(projectData.projectId ?? '').trim();

    const matchesAnswer = params.answerId && candidateAnswerId === params.answerId;
    const matchesProject = params.projectId && candidateProjectId === params.projectId;
    if (!matchesAnswer && !matchesProject) continue;

    const projectMilestonesSource = asRecord(projectEntityData.oceco);
    const projectMilestones = Array.isArray(projectMilestonesSource.milestones) ? (projectMilestonesSource.milestones as unknown[]) : [];
    const depensesFromAnswer = asRecord(asRecord(projectData.answers).aapStep1).depense;
    const depenses = Array.isArray(projectData.depenses)
      ? (projectData.depenses as unknown[])
      : Array.isArray(depensesFromAnswer)
        ? (depensesFromAnswer as unknown[])
        : [];

    const projectMilestoneIndex = projectMilestones.findIndex(
      (milestone) => String(asRecord(milestone).milestoneId ?? '').trim() === params.milestoneId
    );
    const answerDepenseIndex = depenses.findIndex(
      (depense) => String(asRecord(depense).milestone ?? '').trim() === params.milestoneId
    );

    if (projectMilestoneIndex < 0 && answerDepenseIndex < 0) continue;

    return {
      projectMilestoneIndex: projectMilestoneIndex >= 0 ? projectMilestoneIndex : null,
      answerDepenseIndex: answerDepenseIndex >= 0 ? answerDepenseIndex : null,
      description:
        projectMilestoneIndex >= 0 ? String(asRecord(projectMilestones[projectMilestoneIndex]).description ?? '') : '',
    };
  }

  return null;
}

