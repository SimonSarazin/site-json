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

/**
 * Erreur métier du flux d'association.
 *
 * La lib est PURE, sans `t` : elle porte la CLÉ i18n (namespace `modules/aac`)
 * du message à montrer, et c'est le hook (`useAssociateExistingAacProject`) qui
 * la traduit avant que `showErrorToast` ne place `error.message` en description
 * du toast. `message` reste technique, en anglais, pour les logs — jamais une
 * phrase française en dur qu'un anglophone lirait telle quelle.
 */
export class AacProjectLinkError extends Error {
  constructor(
    /** Clé du namespace `modules/aac` du message à afficher. */
    public readonly i18nKey: string,
    message: string,
  ) {
    super(message);
    this.name = "AacProjectLinkError";
  }
}

export const PROJECT_ALREADY_LINKED_I18N_KEY = "detail.project.toasts.alreadyLinked";
export const PROJECT_WITHOUT_ID_I18N_KEY = "detail.project.toasts.projectWithoutId";

export class ProjectAlreadyLinkedError extends AacProjectLinkError {
  constructor(
    /** ID de l'answer qui détient déjà ce projet. */
    public readonly linkedAnswerId: string,
    /** Comment le conflit a été détecté : sur le doc projet, ou via la collection answers. */
    public readonly via: "project-data" | "answers-collection",
  ) {
    super(PROJECT_ALREADY_LINKED_I18N_KEY, `Project already linked to answer ${linkedAnswerId} (via ${via})`);
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
      // ⚠️ `collection` OBLIGATOIRE : le SDK (`_linkEntities`) élimine en
      // silence toute ligne qui ne le porte pas — sans lui, la page revient
      // vide et ce contrôle ne bloque jamais rien. `id` : le SDK ne peuple
      // `.id` que depuis les champs projetés.
      fields: ["_id", "id", "collection", "project"],
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
    throw new AacProjectLinkError(PROJECT_WITHOUT_ID_I18N_KEY, "Project without id: cannot associate it.");
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
  const existingDepenses = depenseEntries(
    asRecord(asRecord(answer.serverData?.answers)[step]).depense
  );
  const alreadyLinkedMilestoneIds = new Set(
    existingDepenses.map(([, depense]) => String(depense.milestone ?? "")).filter(Boolean)
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
  for (const [key, depense] of existingDepenses) {
    if (depense.milestone) continue; // déjà lié — le backend ne retouche pas non plus ce cas
    await answer.generateMilestoneFromDepense(key);
    repairedDepensesCount += 1;
  }

  return {
    projectId: project.id,
    backfilledMilestonesCount: missingMilestones.length,
    repairedDepensesCount,
  };
}

/**
 * Les dépenses d'une réponse AVEC LA CLÉ qu'elles portent dans le document.
 *
 * `generateMilestoneFromDepense(depid)` cible `answers.<step>.depense.<depid>`
 * côté backend : `depid` est la clé du sous-document, pas une position. Or
 * `depense` arrive parfois sérialisé en OBJET à clés creuses (`{"0":…, "3":…}`,
 * pollution Mongo `{}` ↔ `[]`) : `toArrayOrValues` redenserait les clés et l'on
 * réparerait `"1"` — inexistante — au lieu de `"3"`. Même piège que celui que
 * `asStrictArray` ferme dans `cagnotte/lib/milestoneSyncContext`.
 */
function depenseEntries(raw: unknown): Array<[key: string, depense: Record<string, unknown>]> {
  const pairs: Array<[string, unknown]> = Array.isArray(raw)
    ? raw.map((depense, index) => [String(index), depense])
    : Object.entries(asRecord(raw));
  return pairs.flatMap(([key, depense]) =>
    depense && typeof depense === "object" ? [[key, depense as Record<string, unknown>]] : []
  );
}
