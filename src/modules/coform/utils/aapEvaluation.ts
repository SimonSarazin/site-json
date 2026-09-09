/**
 * Helpers purs de l'input `tpls.forms.aap.evaluation` — grille de notation d'un
 * jury, cousine de `selection` mais bâtie autrement.
 *
 * Différences qui comptent :
 *  - les critères sont des LIBELLÉS LIBRES (`{label, coeff, note}`), sans lien
 *    avec une question du dépôt — donc pas de colonne « réponse du candidat » ;
 *  - la valeur stockée est un OBJET par critère, pas un scalaire :
 *    `answers.<étape>.evaluation.<userId>.<index> = {label, note, coeff}`.
 *    Chaque évaluateur enregistre donc sa propre copie du libellé et du coeff ;
 *  - la note est bornée à 10 EN DUR côté legacy (`evaluation.php:205`), sans
 *    `noteMax` configurable ;
 *  - aucun agrégat : le legacy n'affiche ni « mon vote » ni moyenne globale.
 *
 * Comme `selection`, la valeur est scopée par évaluateur et s'écrit par chemin
 * ciblé, hors soumission — le backend remplace en bloc toute clé non suffixée
 * `_multiEval`.
 *
 * Relevé sur `pixelhumain1` : 126 formulaires portent `evaluationCriteria`,
 * 36 réponses portent une valeur.
 */

/** Borne haute des notes, en dur dans le legacy. */
export const AAP_EVALUATION_NOTE_MAX = 10;

export type AapEvaluationVoteType = "starCriterionBased" | "noteCriterionBased";

export interface AapEvaluationCriterion {
  /** Position dans la liste — c'est la CLÉ de stockage, elle ne doit pas bouger. */
  index: string;
  label: string;
  coeff: number;
  /** Note de l'évaluateur courant, 0 s'il n'a pas encore noté. */
  note: number;
}

export interface AapEvaluationConfig {
  voteType: AapEvaluationVoteType;
  criteria: AapEvaluationCriterion[];
}

/** Forme brute de `form.evaluationCriteria`. */
export interface RawAapEvaluationConfig {
  type?: unknown;
  criterions?: unknown;
  activateLocalCriteria?: unknown;
  whoCanEvaluate?: unknown;
}

/** Valeur d'un critère telle que stockée. */
export interface StoredCriterion {
  label?: unknown;
  note?: unknown;
  coeff?: unknown;
}

/** `{ <userId>: { <index>: {label, note, coeff} } }`. */
export type AapEvaluationValue = Record<string, Record<string, StoredCriterion> | undefined>;

/** Nombre exploitable depuis une valeur stockée (les coeffs et notes sont des chaînes en base). */
export function toNumber(value: unknown, defaut = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : defaut;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(",", "."));
    return Number.isFinite(n) ? n : defaut;
  }
  return defaut;
}

/**
 * `activateLocalCriteria` autorise la config LOCALE du formulaire à primer sur
 * celle du document de configuration partagé (`parentForm.config`).
 *
 * Relevé : `true` sur 125 des 126 formulaires. On ne lit donc que la config
 * locale — aller chercher le second document pour l'unique cas restant coûterait
 * une requête à chaque rendu, pour une configuration qui s'affiche alors comme
 * « aucun critère ».
 */
export function isLocalCriteriaActive(raw: RawAapEvaluationConfig | null | undefined): boolean {
  const v = raw?.activateLocalCriteria;
  return v === true || v === "true";
}

/**
 * Lit `form.evaluationCriteria` et y superpose les notes déjà saisies par
 * l'évaluateur courant.
 *
 * Le legacy fait la même chose d'un bloc (`evaluation.php:46`) : il affiche les
 * critères de l'utilisateur s'il a déjà évalué, SINON le modèle de config. La
 * superposition par index est équivalente et supporte en plus le cas d'une
 * évaluation partielle — critères ajoutés à la config après un premier passage.
 */
export function parseAapEvaluationConfig(
  raw: RawAapEvaluationConfig | null | undefined,
  myNotes: Record<string, StoredCriterion> | null | undefined
): AapEvaluationConfig {
  const voteType: AapEvaluationVoteType =
    raw?.type === "noteCriterionBased" ? "noteCriterionBased" : "starCriterionBased";

  const source = raw?.criterions;
  const liste =
    source && typeof source === "object"
      ? Object.entries(source as Record<string, unknown>)
      : [];

  const criteria: AapEvaluationCriterion[] = [];
  for (const [index, brut] of liste) {
    if (!brut || typeof brut !== "object") continue;
    const crit = brut as StoredCriterion;
    const saisi = myNotes?.[index];
    criteria.push({
      index,
      // Le libellé affiché reste celui de la CONFIG : c'est lui qui fait foi si
      // l'admin l'a modifié depuis la dernière évaluation. La copie stockée dans
      // la réponse n'est qu'un instantané.
      label: typeof crit.label === "string" ? crit.label : "",
      coeff: toNumber(crit.coeff, 1),
      note: toNumber(saisi?.note, 0),
    });
  }
  return { voteType, criteria };
}

/**
 * Valeur à écrire pour un critère : le legacy enregistre l'objet complet, pas la
 * seule note (`evaluation.php:211-229`), avec `note` en float et `coeff` en int.
 */
export function buildCriterionValue(
  criterion: AapEvaluationCriterion,
  note: number
): { label: string; note: number; coeff: number } {
  return { label: criterion.label, note, coeff: Math.round(criterion.coeff) };
}

/** Une note est-elle acceptable ? Le legacy refuse au-delà de 10 et remet à 0. */
export function isNoteValid(note: number): boolean {
  return Number.isFinite(note) && note >= 0 && note <= AAP_EVALUATION_NOTE_MAX;
}
