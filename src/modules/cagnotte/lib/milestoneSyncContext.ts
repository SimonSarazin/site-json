import {
  asRecord,
  getEntityId as sharedGetEntityId,
  getServerData,
  type UnknownRecord,
} from '@/modules/cagnotte/utils/dataTransform';

export type { UnknownRecord };
export { asRecord };

/**
 * Les deux documents que porte un palier, **tels que la base les stocke**.
 *
 * Volontairement `unknown` et non `unknown[]` : un champ tableau peut arriver
 * sérialisé en objet (pollution Mongo `{}` ↔ `[]`, cf. `doc/34` §Pièges), et c'est
 * précisément la distinction qu'il faut préserver jusqu'ici — les index qu'on en tire
 * deviennent des chemins Mongo. Ne PAS coercer avant de passer par là.
 */
export type MilestoneSyncDocs = {
  /** `project.oceco.milestones` */
  projectMilestones?: unknown;
  /** `answer.answers.<step>.depense` */
  depenses?: unknown;
};

export type MilestoneSyncContext = {
  projectMilestoneIndex: number | null;
  answerDepenseIndex: number | null;
  description: string;
  /**
   * Le contexte vient des documents en main (`docs`) et non de l'enveloppe.
   *
   * Les deux résolvent les mêmes index, mais pas les mêmes CONNAISSANCES : les
   * documents ne portent pas les actions du palier. Les mutations qui en dépendent
   * (suppression, qui doit supprimer les actions liées) doivent refuser ce mode
   * plutôt que d'agir sur une liste vide. Cf. `getMilestoneConstraints`.
   */
  fromDocs: boolean;
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

/**
 * Le cœur du calcul : où vit ce palier, dans les deux documents qui le portent.
 *
 * Isolé de l'enveloppe à dessein — les deux tableaux peuvent venir d'AILLEURS que
 * d'elle (`project.oceco.milestones[]` lu sur l'entité projet, `depense[]` lu sur la
 * réponse). C'est ce qui permet d'éditer/clôturer/supprimer le palier d'un commun
 * absent de l'enveloppe interrogée, au lieu d'échouer sur `syncContextMissing`.
 *
 * ⚠️ Les index rendus deviennent des CHEMINS MONGO littéraux
 * (`oceco.milestones.<i>.<champ>`, `answers.<step>.depense.<i>.<champ>`, cf.
 * `actionMilestonePathUpdates`). Ils n'ont donc de sens que sur les tableaux tels que
 * le document les porte : passer une liste coercée depuis un objet
 * (`toArrayOrValues`) redense les clés et ferait écrire dans la MAUVAISE entrée. Les
 * appelants filtrent en amont par `Array.isArray` — d'où `asStrictArray` ci-dessous.
 */
export function resolveMilestoneSyncContextFromDocs(params: {
  projectMilestones: unknown[];
  depenses: unknown[];
  milestoneId: string;
  /** Provenance, reportée telle quelle sur le contexte rendu. Défaut : les documents. */
  fromDocs?: boolean;
}): MilestoneSyncContext | null {
  /**
   * Un `milestoneId` VIDE ne désigne aucun palier : sans ce garde, les deux
   * `findIndex` apparient la PREMIÈRE entrée dépourvue du champ (`asRecord(undefined)`
   * → `{}` → `''`), et les index rendus deviennent des chemins Mongo pointant sur le
   * mauvais palier ou la mauvaise dépense.
   */
  if (!params.milestoneId) return null;

  const projectMilestoneIndex = params.projectMilestones.findIndex(
    (milestone) => String(asRecord(milestone).milestoneId ?? '').trim() === params.milestoneId
  );
  const answerDepenseIndex = params.depenses.findIndex(
    (depense) => String(asRecord(depense).milestone ?? '').trim() === params.milestoneId
  );

  if (projectMilestoneIndex < 0 && answerDepenseIndex < 0) return null;

  return {
    projectMilestoneIndex: projectMilestoneIndex >= 0 ? projectMilestoneIndex : null,
    answerDepenseIndex: answerDepenseIndex >= 0 ? answerDepenseIndex : null,
    description:
      projectMilestoneIndex >= 0
        ? String(asRecord(params.projectMilestones[projectMilestoneIndex]).description ?? '')
        : '',
    fromDocs: params.fromDocs ?? true,
  };
}

/**
 * Un vrai tableau, ou rien.
 *
 * Le pendant du ⚠️ ci-dessus : un `depense`/`milestones` sérialisé en objet (pollution
 * Mongo `{}` ↔ `[]`, cf. `doc/34` §Pièges) n'est pas indexable par position. Mieux vaut
 * un `syncContextMissing` explicite qu'une écriture décalée d'un cran.
 */
function asStrictArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function resolveMilestoneSyncContext(params: {
  rawEnvelope: unknown;
  projectId: string;
  answerId: string;
  milestoneId: string;
  /**
   * Documents bruts servant de REPLI quand l'enveloppe ne porte pas cette
   * ressource (commun déposé sous un autre contexte, enveloppe non chargée).
   */
  docs?: MilestoneSyncDocs | null;
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

    const fromEnvelope = resolveMilestoneSyncContextFromDocs({
      projectMilestones,
      depenses,
      milestoneId: params.milestoneId,
      fromDocs: false,
    });
    if (!fromEnvelope) continue;
    return fromEnvelope;
  }

  if (params.docs) {
    return resolveMilestoneSyncContextFromDocs({
      projectMilestones: asStrictArray(params.docs.projectMilestones),
      depenses: asStrictArray(params.docs.depenses),
      milestoneId: params.milestoneId,
      fromDocs: true,
    });
  }

  return null;
}

