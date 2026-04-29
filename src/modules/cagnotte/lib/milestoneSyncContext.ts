export type MilestoneSyncContext = {
  projectMilestoneIndex: number | null;
  answerDepenseIndex: number | null;
  description: string;
};

type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

export function getEntityIdFromUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const record = value as UnknownRecord;
  if (typeof record.id === 'string') return record.id;

  const mongo = asRecord(record._id);
  if (typeof mongo._str === 'string') return mongo._str;
  if (typeof mongo.$id === 'string') return mongo.$id;
  if (typeof record.$id === 'string') return String(record.$id);

  return '';
}

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
    const projectData = asRecord(projectRow._serverData ?? projectRow.serverData ?? projectRow);
    const candidateAnswerId = getEntityIdFromUnknown(projectData) || String(projectData.answer ?? '').trim();
    const candidateProjectId =
      String(asRecord(projectData.project).id ?? '').trim() ||
      getEntityIdFromUnknown(projectRow.projectIdObj) ||
      String(projectData.projectId ?? '').trim();

    const matchesAnswer = params.answerId && candidateAnswerId === params.answerId;
    const matchesProject = params.projectId && candidateProjectId === params.projectId;
    if (!matchesAnswer && !matchesProject) continue;

    const projectMilestonesSource = asRecord(asRecord(projectData.project).oceco);
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

