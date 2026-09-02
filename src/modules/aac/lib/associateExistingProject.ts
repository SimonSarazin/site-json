/**
 * Associe un commun AAC à un projet DÉJÀ EXISTANT — alternative à
 * `Answer.generateProject()` (qui en crée un nouveau)
 */
import type { Answer, Organization, Project } from "@communecter/cocolight-api-client";
import { appendAnswerDepense, DEFAULT_AAC_STEP } from "@/modules/cagnotte/lib/actionMilestonePathUpdates";
import { asRecord, toArrayOrValues } from "@/modules/cagnotte/utils/dataTransform";

export interface AssociateExistingProjectResult {
  projectId: string;
  /** Milestones du projet backfillés en nouvelles dépenses côté answer. */
  backfilledMilestonesCount: number;
  /** Dépenses préexistantes de l'answer réparées avec un nouveau milestone projet. */
  repairedDepensesCount: number;
}

/** Entité hôte du costum (Org|Project) — seule à porter le `coformAnswersSearch` scopé costum. */
type CostumHost = Pick<Organization | Project, "coformAnswersSearch">;

export class ProjectAlreadyLinkedError extends Error {
  constructor(
    /** ID de l'answer qui détient déjà ce projet. */
    public readonly linkedAnswerId: string,
    /** Comment le conflit a été détecté : sur le doc projet, ou via la collection answers. */
    public readonly via: "project-data" | "answers-collection",
  ) {
    super("Ce projet est déjà rattaché à un autre commun. Choisis-en un autre ou génère un nouveau projet.");
    this.name = "ProjectAlreadyLinkedError";
  }
}

/**
 * Double vérification qu'un projet n'est pas DÉJÀ le projet d'un autre commun,
 * AVANT d'écrire `answer.project`. Deux sources indépendantes (l'une peut être
 * en retard sur l'autre) :
 *
 *  1. **Donnée du projet** — `project.serverData.answer` (back-ref answer→projet).
 *     Posé activement par ce flux (cf. plus bas) ET par la génération
 *     (`GenerateprojectAction.php`) ; sert aussi à `useOrganizationProjectsWithAnswers`
 *     (qui filtre `answer.$exists`). Seul contrôle qui traverse les costums.
 *  2. **Collection answers** — `context.coformAnswersSearch({ filters: { "project.id": <id> } })`
 *     (scopé au costum courant : on veut savoir « déjà un commun de CET AAC »).
 *     `SearchNew::searchFilters` accepte un chemin pointé en valeur scalaire.
 *
 * Ré-associer le MÊME commun à son propre projet reste autorisé (no-op) : on
 * exclut `answer.id` des deux contrôles.
 */
async function assertProjectAssociable(params: {
  answer: Answer;
  project: Project;
  context?: CostumHost | null;
}): Promise<void> {
  const { answer, project, context } = params;
  const currentAnswerId = String(answer.id ?? "").trim();

  // Donnée du projet
  const projectLinkedAnswerId = String(asRecord(project.serverData).answer ?? "").trim();
  if (projectLinkedAnswerId && projectLinkedAnswerId !== currentAnswerId) {
    throw new ProjectAlreadyLinkedError(projectLinkedAnswerId, "project-data");
  }

  // Collection answers — best-effort : si la recherche échoue (contexte costum
  // absent, réseau…), on ne bloque pas l'association sur ce seul motif.
  if (!context || !project.id) return;
  try {
    const page = await context.coformAnswersSearch({
      searchType: ["answers"],
      filters: { "project.id": project.id },
      fields: ["_id", "project"],
      count: true,
      indexMin: 0,
      indexStep: 5,
    });
    const conflictingId = (page?.results ?? [])
      .map((row) => String((row as { id?: string }).id ?? "").trim())
      .find((id) => id && id !== currentAnswerId);
    if (conflictingId) {
      throw new ProjectAlreadyLinkedError(conflictingId, "answers-collection");
    }
  } catch (error) {
    if (error instanceof ProjectAlreadyLinkedError) throw error;
    console.warn("associateExistingProject: recherche answers-par-projet indisponible, contrôle #2 ignoré", error);
  }
}

export async function associateExistingProject(params: {
  answer: Answer;
  project: Project;
  userId: string;
  /** Étape portant le champ dépense. Défaut : `aapStep1`. */
  step?: string;
  /** Hôte du costum (`useCocolight().entity`) — pour le contrôle #2 (collection answers). */
  context?: CostumHost | null;
}): Promise<AssociateExistingProjectResult> {
  const { answer, project, userId } = params;
  const step = params.step || DEFAULT_AAC_STEP;

  if (!project.id) {
    throw new Error("Projet sans id, impossible de l'associer.");
  }

  await assertProjectAssociable({ answer, project, context: params.context });

  await answer.updateField("project", { id: project.id, startDate: new Date().toISOString() }, {});

  try {
    await project.updateField("answer", String(answer.id ?? ""), {});
  } catch (error) {
    console.warn("associateExistingProject: back-ref project.answer non posé", error);
  }

  // Dédup : n'ajouter une dépense que pour les milestones du projet qui n'en
  // ont pas déjà une côté answer (idempotent si rejoué).
  const existingDepenses = toArrayOrValues<Record<string, unknown>>(
    asRecord(asRecord(answer.serverData?.answers)[step]).depense
  );
  const alreadyLinkedMilestoneIds = new Set(
    existingDepenses.map((depense) => String(depense.milestone ?? "")).filter(Boolean)
  );

  const projectMilestones = toArrayOrValues<{ milestoneId?: string; name?: string }>(
    asRecord(project.serverData?.oceco).milestones
  );
  const missingMilestones = projectMilestones.filter(
    (milestone) => milestone.milestoneId && !alreadyLinkedMilestoneIds.has(milestone.milestoneId)
  );

  for (const milestone of missingMilestones) {
    await appendAnswerDepense({
      answer,
      step,
      depense: {
        poste: milestone.name || "Palier",
        price: 0,
        date: new Date().toISOString(),
        user: userId,
        milestone: milestone.milestoneId as string,
        financer: [],
      },
    });
  }

  let repairedDepensesCount = 0;
  for (const [index, depense] of existingDepenses.entries()) {
    if (depense.milestone) continue; // déjà lié — le backend ne retouche pas non plus ce cas
    await answer.generateMilestoneFromDepense(String(index));
    repairedDepensesCount += 1;
  }

  return {
    projectId: project.id,
    backfilledMilestonesCount: missingMilestones.length,
    repairedDepensesCount,
  };
}
