import { generateDefaultValues, generateZodSchema } from "./formParser";
import type { AllStepsData, SubFormData, SubFormFields } from "../types";

/**
 * Modèle de l'en-tête de navigation entre étapes (`StepsNav`).
 *
 * Tout ce qui décide *quoi* afficher vit ici, en fonctions pures : le composant
 * ne fait que rendre. Les règles viennent du banc d'essai `.claude/doc/stepper-banc-essai.html`
 * (option A sur ordinateur, B sur téléphone), tranché avec l'user le 4 septembre.
 */

/** État d'une étape, dans l'ordre de priorité où il est calculé. */
export type StepStatus = "current" | "locked" | "error" | "done" | "todo";

export interface StepNavItem {
  /** Index dans `subFormsFields` — c'est lui qu'on passe à `goToStep`. */
  index: number;
  /** `subFormId` de l'étape. */
  id: string;
  /**
   * Nom de l'étape. **Vide quand le formulaire n'en donne pas** : on n'en
   * fabrique pas (« Étape 3 » n'est écrit nulle part dans le formulaire, et une
   * étape sans titre est souvent un choix de son auteur). La pastille porte le
   * numéro, le compteur dit « Étape 3 sur 11 ».
   */
  name: string;
  status: StepStatus;
  /** Une étape réservée à un autre rôle n'est pas atteignable. */
  clickable: boolean;
}

/** Au-delà de ce nombre d'étapes, l'en-tête n'en montre plus qu'une fenêtre. */
export const STEPS_WINDOW_THRESHOLD = 6;

/** Taille de cette fenêtre. Impaire : l'étape courante est au centre. */
export const STEPS_WINDOW_SIZE = 5;

interface BuildStepItemsArgs {
  steps: SubFormFields[];
  currentIndex: number;
  /** `subFormId` des étapes soumises avec succès. */
  completedIds: readonly string[];
  /** `subFormId` des étapes dont la validation ou l'envoi a échoué. */
  errorIds?: readonly string[];
  /** `subFormId` des étapes réservées à un autre rôle (droits par étape AAP). */
  lockedIds?: readonly string[];
  /**
   * Navigation libre entre étapes. Défaut : true — décision du 4 septembre,
   * toutes les étapes sont cliquables, en création comme en édition. À false,
   * l'en-tête reste lisible mais ne mène nulle part.
   */
  navigable?: boolean;
}

/**
 * Traduit l'état du provider en liste d'étapes prête à rendre.
 *
 * Priorité : courante > réservée > en erreur > complétée > à faire. La courante
 * gagne sur l'erreur parce que l'erreur est déjà sous les yeux, dans le
 * formulaire ; c'est en la quittant qu'elle doit rester visible dans l'en-tête.
 */
export function buildStepItems({
  steps,
  currentIndex,
  completedIds,
  errorIds = [],
  lockedIds = [],
  navigable = true,
}: BuildStepItemsArgs): StepNavItem[] {
  const completed = new Set(completedIds);
  const errored = new Set(errorIds);
  const locked = new Set(lockedIds);

  return steps.map((step, index) => {
    const isLocked = locked.has(step.subFormId);
    let status: StepStatus;
    if (index === currentIndex) status = "current";
    else if (isLocked) status = "locked";
    else if (errored.has(step.subFormId)) status = "error";
    else if (completed.has(step.subFormId)) status = "done";
    else status = "todo";

    return {
      index,
      id: step.subFormId,
      name: step.subFormName ?? "",
      status,
      clickable: navigable && !isLocked,
    };
  });
}

/**
 * Fenêtre d'étapes visibles dans l'en-tête.
 *
 * Jusqu'à `threshold` étapes, tout est visible. Au-delà, une fenêtre de `size`
 * glisse en gardant l'étape courante au centre, et bute proprement aux deux
 * bouts (pas de fenêtre plus courte que `size` en début ou en fin de parcours).
 */
export function computeStepsWindow(
  total: number,
  currentIndex: number,
  threshold: number = STEPS_WINDOW_THRESHOLD,
  size: number = STEPS_WINDOW_SIZE
): { start: number; end: number } {
  if (total <= threshold) return { start: 0, end: total };

  const half = Math.floor(size / 2);
  const start = Math.max(0, Math.min(currentIndex - half, total - size));
  return { start, end: start + size };
}

/** État du trait qui relie deux étapes. */
export type RailState = "done" | "error" | "todo";

/**
 * Le trait entre deux étapes n'est **plein que si ses deux bouts sont atteints**
 * (complétée, courante ou en erreur) ; il reste pointillé sinon. Conséquence
 * voulue : après un saut de la 1 à la 3, les deux segments autour de la 2
 * restent pointillés — le rail montre ce qui a été sauté.
 */
export function railStateBetween(
  from: StepNavItem | undefined,
  to: StepNavItem | undefined
): RailState {
  if (!from || !to) return "todo";
  const reached = (item: StepNavItem) =>
    item.status === "done" || item.status === "current" || item.status === "error";
  if (!reached(from) || !reached(to)) return "todo";
  return from.status === "error" || to.status === "error" ? "error" : "done";
}

/**
 * Une étape est « complétée » quand ses données passeraient sa propre validation
 * — c'est ce que le mot voudra dire au moment de soumettre, et c'est la seule
 * définition qui tienne quand on navigue librement : cliquer une pastille ne
 * passe par aucun bouton « Suivant ».
 *
 * Le schéma est construit sans traducteur : on ne lit que `success`, jamais les
 * messages. Les valeurs manquantes sont complétées par les défauts générés, pour
 * juger la même donnée que celle qui serait envoyée.
 */
export function isSubFormValid(
  subForm: SubFormFields,
  data: SubFormData | undefined,
  /**
   * Champs que l'utilisateur ne voit pas (`access.restrictedFields`) : les juger
   * bloquerait la soumission sur un champ qu'il ne peut ni lire ni remplir.
   */
  skipFieldKeys?: readonly string[]
): boolean {
  const ignores = new Set(skipFieldKeys ?? []);
  const visible: SubFormFields = ignores.size
    ? { ...subForm, fields: subForm.fields.filter((f) => !ignores.has(f.name)) }
    : subForm;
  const complete = { ...generateDefaultValues([visible]), ...(data ?? {}) };
  return generateZodSchema([visible]).safeParse(complete).success;
}

/** Les `subFormId` déjà valides dans un jeu de valeurs — l'état de départ en édition. */
export function completedStepIds(
  steps: readonly SubFormFields[],
  values: AllStepsData | undefined
): string[] {
  if (!values) return [];
  return steps
    .filter((step) => {
      const data = values[step.subFormId];
      return !!data && typeof data === "object" && isSubFormValid(step, data as SubFormData);
    })
    .map((step) => step.subFormId);
}

/** Étapes qui ne passeraient pas la validation — la garde de la soumission finale. */
export function invalidSteps(
  steps: readonly SubFormFields[],
  values: AllStepsData,
  skipFieldKeys?: readonly string[]
): SubFormFields[] {
  return steps.filter(
    (step) => !isSubFormValid(step, values[step.subFormId] as SubFormData | undefined, skipFieldKeys)
  );
}

/** Première étape à corriger, pour le raccourci du sommaire. Null s'il n'y en a pas. */
export function firstErrorStep(steps: readonly StepNavItem[]): StepNavItem | null {
  return steps.find((step) => step.status === "error") ?? null;
}
