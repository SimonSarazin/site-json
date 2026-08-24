import type { Action, Answer, Project, SetTypeValue } from "@communecter/cocolight-api-client";

type SetType = SetTypeValue | Array<{ path: string; type: SetTypeValue }>;

/**
 * Étape par défaut des données d'un commun AAC.
 *
 * ⚠️ Le module AAC suppose partout que le commun vit sur `aapStep1` (65 sites au
 * 2026-08-24). Ces primitives acceptent donc un `step` explicite — le champ
 * coform, lui, connaît sa vraie étape — tout en gardant ce défaut pour ne pas
 * casser les appelants historiques. Ce n'est PAS une levée de l'hypothèse
 * module-wide : cf. le BACKLOG.
 */
export const DEFAULT_AAC_STEP = "aapStep1";

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
  /** Étape portant le champ dépense. Défaut : `aapStep1` (cf. DEFAULT_AAC_STEP). */
  step?: string;
  depense: {
    poste: string;
    price: number;
    date: string;
    user: string;
    milestone: string;
    financer?: unknown[];
  };
}) {
  const step = params.step || DEFAULT_AAC_STEP;
  return params.answer.updateField(`answers.${step}.depense`, params.depense, {
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
  /** Étape portant le champ dépense. Défaut : `aapStep1` (cf. DEFAULT_AAC_STEP). */
  step?: string;
}) {
  const step = params.step || DEFAULT_AAC_STEP;
  for (const [field, value] of Object.entries(params.fields)) {
    await params.answer.updateField(
      `answers.${step}.depense.${params.index}.${field}`,
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
  /** Étape portant le champ dépense. Défaut : `aapStep1` (cf. DEFAULT_AAC_STEP). */
  step?: string;
}) {
  const step = params.step || DEFAULT_AAC_STEP;
  return params.answer.updateField(
    `answers.${step}.depense.${params.index}`,
    null,
    { pull: `answers.${step}.depense` },
  );
}
