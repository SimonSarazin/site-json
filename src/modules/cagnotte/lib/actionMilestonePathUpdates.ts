import type { Action, Answer, Project, SetTypeValue } from "@communecter/cocolight-api-client";

type SetType = SetTypeValue | Array<{ path: string; type: SetTypeValue }>;

export async function appendProjectMilestone(params: {
  project: Project;
  milestone: {
    milestoneId: string;
    name: string;
    description: string;
    status: "open" | "done";
  };
}) {
  return params.project.updateField("oceco.milestones", params.milestone, {
    arrayForm: true,
  });
}

export async function appendAnswerDepense(params: {
  answer: Answer;
  depense: {
    poste: string;
    price: number;
    date: string;
    user: string;
    milestone: string;
    financer?: unknown[];
  };
}) {
  return params.answer.updateField("answers.aapStep1.depense", params.depense, {
    arrayForm: true,
    setType: [
      { path: "date", type: "isoDate" },
      { path: "price", type: "int" },
    ],
  });
}

/**
 * Supprime une action via `Action.delete(reason?)` (lib 1.0.137+).
 *
 * Guard côté entité : `isAuthorOrAdmin({checkHierarchy: true})` — autorise l'auteur
 * de l'Action OU les admins du projet parent (via la hiérarchie).
 */
export async function deleteActionById(params: { action: Action }) {
  return params.action.delete("delete action via cagnotte");
}

export async function updateProjectMilestoneFields(params: {
  project: Project;
  index: number;
  fields: Record<string, unknown>;
}) {
  for (const [field, value] of Object.entries(params.fields)) {
    await params.project.updateField(
      `oceco.milestones.${params.index}.${field}`,
      value,
    );
  }
}

export async function updateAnswerDepenseFields(params: {
  answer: Answer;
  index: number;
  fields: Record<string, unknown>;
  setType?: SetType;
}) {
  for (const [field, value] of Object.entries(params.fields)) {
    await params.answer.updateField(
      `answers.aapStep1.depense.${params.index}.${field}`,
      value,
      params.setType ? { setType: params.setType } : {},
    );
  }
}

export async function deleteProjectMilestoneAtIndex(params: {
  project: Project;
  index: number;
}) {
  // R2 (lib) auto-convertit `value: null` → `""` quand combiné avec `pull`.
  return params.project.updateField(
    `oceco.milestones.${params.index}`,
    null,
    { pull: "oceco.milestones" },
  );
}

export async function deleteAnswerDepenseAtIndex(params: {
  answer: Answer;
  index: number;
}) {
  return params.answer.updateField(
    `answers.aapStep1.depense.${params.index}`,
    null,
    { pull: "answers.aapStep1.depense" },
  );
}
