import type { Action, Answer, Project, SetTypeValue } from "@communecter/cocolight-api-client";

type SetType = SetTypeValue | Array<{ path: string; type: SetTypeValue }>;

/**
 * Met à jour un champ unique d'une action via `Action.updateField` (lib 1.0.137+).
 *
 * Note historique : ce wrapper avait un cousin `kind: "milestone"` qui ciblait
 * `answers.aapStep1.depense.{i}.{field}`, mais cette branche n'a jamais été utilisée
 * (les opérations milestone passent par `updateAnswerDepenseFields` /
 * `updateProjectMilestoneFields` plus bas).
 */
export async function updateActionField(params: {
  action: Action;
  field: string;
  value: unknown;
  setType?: SetType;
}) {
  return params.action.updateField(
    params.field,
    params.value,
    params.setType ? { setType: params.setType } : {},
  );
}

export async function updateProjectActionFields(params: {
  action: Action;
  fields: Record<string, unknown>;
  setType?: SetType;
}) {
  const entries = Object.entries(params.fields);
  const isDateField = (field: string) => field === "startDate" || field === "endDate";

  const dateEntries = entries.filter(([field]) => isDateField(field));
  const otherEntries = entries.filter(([field]) => !isDateField(field));

  // Champs non-date: jamais de setType (séquentiel pour conserver l'ordre côté backend)
  for (const [field, value] of otherEntries) {
    await params.action.updateField(field, value);
  }

  // Champs date: parallèle. R0 (lib) auto-pose `setType: "isoDate"` si la value est
  // une instance Date. Sinon, un setType array peut être passé par le caller.
  if (dateEntries.length > 0) {
    const dateSetType = Array.isArray(params.setType)
      ? params.setType.filter((item) => isDateField(item.path))
      : undefined;
    const safeDateSetType = dateSetType && dateSetType.length > 0 ? dateSetType : undefined;

    await Promise.all(
      dateEntries.map(([field, value]) =>
        params.action.updateField(
          field,
          value,
          typeof value === "string" && safeDateSetType
            ? { setType: "isoDate" }
            : safeDateSetType
              ? { setType: safeDateSetType }
              : {},
        ),
      ),
    );
  }
}

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
