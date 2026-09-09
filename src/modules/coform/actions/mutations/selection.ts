import { createCoFormMutation, CoFormContextError } from "./core";
import { COFORM_QUERY_KEYS } from "../../constants/queryKeys";

/**
 * Mutations de l'input `tpls.forms.aap.selection` (grille de notation d'un jury).
 *
 * Ces valeurs s'écrivent par CHEMIN CIBLÉ, jamais par soumission du formulaire.
 * La raison n'est pas stylistique : `answers.<étape>.selection` est un objet
 * indexé par ÉVALUATEUR, et `SaveAnswerAction` ne deep-merge que les clés
 * suffixées `_multiEval` (`:214`) — soumettre la clé la remplacerait en bloc et
 * effacerait les notes de tous les autres évaluateurs. Le legacy procède de même
 * (`dataHelper.path2Value`), si bien que les deux implémentations peuvent
 * coexister sur une même réponse sans se détruire.
 */

/** Chemin d'une note : `answers.<étape>.selection.<userId>.<critère>`. */
export function buildNotePath(subFormId: string, userId: string, fieldKey: string): string {
  return `answers.${subFormId}.selection.${userId}.${fieldKey}`;
}

/** Chemin d'un avis d'admissibilité : `answers.<étape>.admissibility.<userId>`. */
export function buildAdmissibilityPath(subFormId: string, userId: string): string {
  return `answers.${subFormId}.admissibility.${userId}`;
}

interface NoteParams {
  subFormId: string;
  userId: string;
  fieldKey: string;
  /** Note déjà validée dans `[0, noteMax]` par l'appelant. */
  note: number;
}

/**
 * Enregistre une note sur un critère.
 *
 * `setType: "float"` reprend le legacy : les notes autorisent les décimales
 * (relevé en base : `"3.5"`), et sans coercion la valeur partirait en chaîne.
 */
export const useSaveSelectionNote = createCoFormMutation<NoteParams>({
  action: async (ctx, { subFormId, userId, fieldKey, note }) => {
    if (!ctx.answerId) throw new CoFormContextError("errors.answerIdMissing");
    const form = await ctx.api.form({ id: ctx.formId });
    const answer = await form.answer({ id: ctx.answerId });
    await answer.updateField(buildNotePath(subFormId, userId, fieldKey), note, {
      setType: "float",
    });
  },
  i18n: {
    successKey: "coform.selection.toasts.noteSaved",
    errorKey: "coform.selection.toasts.noteFailed",
  },
  // La moyenne « tous les votants » dépend des notes de chacun : il faut relire
  // la réponse pour la recalculer, pas seulement l'état local de l'évaluateur.
  invalidate: (ctx) => [COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX(ctx.formId, ctx.answerId ?? null)],
});

interface AdmissibilityParams {
  subFormId: string;
  userId: string;
  /** `"admissible"` | `"inadmissible"` — les deux seules valeurs que pose cet écran. */
  value: string;
}

/** Horodatage de l'avis : `answers.<étape>.admissibilityTime.<userId>`. */
export function buildAdmissibilityTimePath(subFormId: string, userId: string): string {
  return `answers.${subFormId}.admissibilityTime.${userId}`;
}

/** Jeton de statut poussé sur la candidature quand un évaluateur la juge admissible. */
export const VOTE_STATUS = "vote";

/**
 * Enregistre l'avis d'admissibilité de l'évaluateur courant, et — si l'avis est
 * « admissible » — fait passer la candidature au statut de vote.
 *
 * Séquence reprise de `selection.php:655-720`, dans l'ordre :
 *  1. l'avis lui-même ;
 *  2. son horodatage, via la valeur magique `"updatedTime"` que le backend
 *     remplace par son propre `time()` — l'heure ne vient pas du client ;
 *  3. UNIQUEMENT si « admissible » : le jeton `"vote"` dans `status` (un
 *     tableau de jetons cumulés) et la trace `statusInfo.vote`.
 *
 * ⚠️ ÉCART DÉLIBÉRÉ AU LEGACY — le jeton n'est poussé que s'il est ABSENT.
 * Le legacy fait un `$push` inconditionnel : chaque évaluateur qui coche
 * « admissible » ajoute un `"vote"` de plus. Relevé en base : 5 candidatures sur
 * 126 portent le jeton 2 à 4 fois. La multiplicité n'a aucun sens fonctionnel
 * (seule la présence compte) et pollue la donnée ; on ne reproduit pas le
 * défaut.
 *
 * `statusInfo.vote` suit la forme du legacy (`user` + `action` + `updated` en
 * Date, 11 occurrences en base) plutôt que la forme majoritaire à deux clés
 * (114), écrite par un autre chemin : les deux coexistent déjà, et c'est ce
 * geste-ci qu'on porte. `user` vaut `""`, la valeur réellement observée dans les
 * 125 cas (le `null` du legacy y atterrit ainsi).
 *
 * Non porté : le ping WebSocket et l'appel `notifyAddEvaluation`, qui sont des
 * dépendances externes non testables ici — voir le dossier projet.
 *
 * Relevé en base : `admissibility` porte aussi `instruction` (16) et `rejected`
 * (10), posés par d'AUTRES écrans. Cet input n'en pose jamais : il se contente
 * de ne pas les écraser tant que l'évaluateur ne tranche pas lui-même.
 */
/** Ce que la séquence attend d'une entité `Answer` — de quoi la tester sans React. */
export interface AdmissibilityTarget {
  serverData?: { status?: unknown } | null;
  updateField: (path: string, value: unknown, opts?: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Séquence d'écritures de l'avis d'admissibilité. Extraite du hook pour être
 * testable telle quelle : c'est la partie qui touche au cycle de vie de la
 * candidature, donc celle qu'il faut pouvoir vérifier écriture par écriture.
 */
export async function applyAdmissibility(
  answer: AdmissibilityTarget,
  { subFormId, userId, value }: AdmissibilityParams,
  now: Date = new Date()
): Promise<void> {
  await answer.updateField(buildAdmissibilityPath(subFormId, userId), value);
  await answer.updateField(buildAdmissibilityTimePath(subFormId, userId), "updatedTime");

  if (value !== "admissible") return;

  const statuts = answer.serverData?.status;
  const dejaVote = Array.isArray(statuts) && statuts.indexOf(VOTE_STATUS) !== -1;
  if (!dejaVote) {
    await answer.updateField("status", VOTE_STATUS, { arrayForm: true });
  }
  await answer.updateField("statusInfo.vote", { user: "", action: "add", updated: now });
}

export const useSaveAdmissibility = createCoFormMutation<AdmissibilityParams>({
  action: async (ctx, params) => {
    if (!ctx.answerId) throw new CoFormContextError("errors.answerIdMissing");
    const form = await ctx.api.form({ id: ctx.formId });
    const answer = await form.answer({ id: ctx.answerId });
    // Cast d'adaptation : `AdmissibilityTarget` est le sous-ensemble de l'entité
    // SDK dont la séquence a besoin, déclaré pour pouvoir la tester sans réseau.
    // L'entité le satisfait structurellement ; le double cast n'est là que parce
    // que ses types déclarent `updateField` avec des options plus étroites.
    await applyAdmissibility(answer as unknown as AdmissibilityTarget, params);
  },
  i18n: {
    successKey: "coform.selection.toasts.admissibilitySaved",
    errorKey: "coform.selection.toasts.admissibilityFailed",
  },
  invalidate: (ctx) => [COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX(ctx.formId, ctx.answerId ?? null)],
});

/** Chemin d'un vote pour/neutre/contre : `answers.<étape>.pourContre.<userId>`. */
export function buildVotePath(subFormId: string, userId: string): string {
  return `answers.${subFormId}.pourContre.${userId}`;
}

interface VoteParams {
  subFormId: string;
  userId: string;
  /** `"1"` | `"0"` | `"-1"` — stockés en CHAÎNES en base, comme le legacy. */
  vote: string;
}

/**
 * Enregistre le vote pour/neutre/contre de l'évaluateur courant.
 *
 * Pas de `setType` : les 11 valeurs relevées en base sont des chaînes, et le
 * legacy écrit `$(this).data('vote')` tel quel. Les coercer en nombre créerait
 * deux formes concurrentes pour la même donnée.
 */
export const useSaveVote = createCoFormMutation<VoteParams>({
  action: async (ctx, { subFormId, userId, vote }) => {
    if (!ctx.answerId) throw new CoFormContextError("errors.answerIdMissing");
    const form = await ctx.api.form({ id: ctx.formId });
    const answer = await form.answer({ id: ctx.answerId });
    await answer.updateField(buildVotePath(subFormId, userId), vote);
  },
  i18n: {
    successKey: "coform.pourContre.toasts.voteSaved",
    errorKey: "coform.pourContre.toasts.voteFailed",
  },
  invalidate: (ctx) => [COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX(ctx.formId, ctx.answerId ?? null)],
});

/** Chemin d'une note AAP : `answers.<étape>.evaluation.<userId>.<index>`. */
export function buildAapEvaluationPath(
  subFormId: string,
  userId: string,
  index: string
): string {
  return `answers.${subFormId}.evaluation.${userId}.${index}`;
}

interface AapEvaluationNoteParams {
  subFormId: string;
  userId: string;
  index: string;
  /** Objet complet `{label, note, coeff}` — le legacy n'écrit pas la seule note. */
  value: { label: string; note: number; coeff: number };
}

/**
 * Enregistre la note d'un critère de `tpls.forms.aap.evaluation`.
 *
 * `setType` reprend celui du legacy (`evaluation.php:220-228`) : `note` en float
 * (les demi-points sont autorisés), `coeff` en int. Sans cela, la valeur partirait
 * en chaînes et viendrait grossir le mélange de types déjà présent en base.
 */
export const useSaveAapEvaluationNote = createCoFormMutation<AapEvaluationNoteParams>({
  action: async (ctx, { subFormId, userId, index, value }) => {
    if (!ctx.answerId) throw new CoFormContextError("errors.answerIdMissing");
    const form = await ctx.api.form({ id: ctx.formId });
    const answer = await form.answer({ id: ctx.answerId });
    await answer.updateField(buildAapEvaluationPath(subFormId, userId, index), value, {
      setType: [
        { path: "note", type: "float" },
        { path: "coeff", type: "int" },
      ],
    });
  },
  i18n: {
    successKey: "coform.aapEvaluation.toasts.noteSaved",
    errorKey: "coform.aapEvaluation.toasts.noteFailed",
  },
  invalidate: (ctx) => [COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX(ctx.formId, ctx.answerId ?? null)],
});

/** Chemin d'un choix de publication : `answers.<étape>.choose.<contextId>`. */
export function buildChoosePath(subFormId: string, contextId: string): string {
  return `answers.${subFormId}.choose.${contextId}`;
}

interface ChooseParams {
  subFormId: string;
  contextId: string;
  entry: { value: string; type: string | null; name: string | null };
}

/**
 * Enregistre le choix de publication pour LE CONTEXTE COURANT.
 *
 * Le chemin descend jusqu'au `contextId` : un `$set` à ce niveau ne touche pas
 * aux entrées des autres costums. C'est indispensable — 9 des 59 réponses en base
 * portent 2 ou 3 contextes, et écrire la clé `choose` entière effacerait leurs
 * choix (le backend remplace en bloc toute clé non suffixée `_multiEval`).
 */
export const useSaveChooseProposal = createCoFormMutation<ChooseParams>({
  action: async (ctx, { subFormId, contextId, entry }) => {
    if (!ctx.answerId) throw new CoFormContextError("errors.answerIdMissing");
    const form = await ctx.api.form({ id: ctx.formId });
    const answer = await form.answer({ id: ctx.answerId });
    await answer.updateField(buildChoosePath(subFormId, contextId), entry);
  },
  i18n: {
    successKey: "coform.chooseProposal.toasts.saved",
    errorKey: "coform.chooseProposal.toasts.failed",
  },
  invalidate: (ctx) => [COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX(ctx.formId, ctx.answerId ?? null)],
});
