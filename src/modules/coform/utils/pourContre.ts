/**
 * Helpers purs de l'input `tpls.forms.ocecoform.pourContre` — vote simple d'un
 * jury sur une candidature.
 *
 * Comme `selection`, la valeur est scopée par ÉVALUATEUR
 * (`answers.<étape>.pourContre.<userId>`) et s'écrit par chemin ciblé, hors
 * soumission : le backend remplace en bloc toute clé non suffixée `_multiEval`.
 *
 * Relevé en base (`pixelhumain1`) : 11 réponses, valeurs stockées en CHAÎNES
 * (`"1"`, `"0"`, `"-1"`), jamais en nombres.
 */

/** Les trois votes possibles, dans l'ordre d'affichage du legacy. */
export const POUR = "1";
export const NEUTRE = "0";
export const CONTRE = "-1";

export type VoteValue = typeof POUR | typeof NEUTRE | typeof CONTRE;

export const VOTE_VALUES: VoteValue[] = [POUR, NEUTRE, CONTRE];

/** Valeur complète de la clé `pourContre` : `{ <userId>: vote }`. */
export type PourContreValue = Record<string, unknown>;

export interface VoteTally {
  pour: number;
  neutre: number;
  contre: number;
  total: number;
  /** Parts en pourcentage, arrondies à l'entier et sommant à 100 (hors total nul). */
  pourPct: number;
  neutrePct: number;
  contrePct: number;
}

/** Normalise une valeur stockée vers l'un des trois votes, ou `null`. */
export function toVote(value: unknown): VoteValue | null {
  const s = typeof value === "number" ? String(value) : value;
  if (s === POUR || s === NEUTRE || s === CONTRE) return s;
  return null;
}

/**
 * Vote de l'utilisateur courant.
 *
 * ⚠️ Le legacy calcule ceci dans la boucle de comptage et **écrase `$myVote` à
 * la chaîne vide à chaque itération portant sur un autre évaluateur**
 * (`pourContre.php:14-23`) : le vote n'est correctement affiché que si l'entrée
 * de l'utilisateur est la DERNIÈRE du parcours. Une simple lecture indexée suffit
 * et n'a pas ce défaut.
 */
export function getMyVote(
  value: PourContreValue | null | undefined,
  userId: string | null | undefined
): VoteValue | null {
  if (!value || typeof value !== "object" || !userId) return null;
  return toVote(value[userId]);
}

/**
 * Décompte des votes et parts en pourcentage.
 *
 * ⚠️ Le legacy calcule `pour% = pour × total × 100` — une MULTIPLICATION là où
 * il faut une division (`pourContre.php:26-28`). Avec 2 « pour » sur 3 votants,
 * il affiche 600 % et la barre de progression déborde. On calcule la vraie part.
 *
 * On conserve en revanche son garde-fou : quand aucun vote n'est ni pour ni
 * contre, la part « neutre » vaut 100 %.
 */
export function tallyVotes(value: PourContreValue | null | undefined): VoteTally {
  let pour = 0;
  let neutre = 0;
  let contre = 0;

  const entries = value && typeof value === "object" ? Object.values(value) : [];
  for (const brut of entries) {
    const vote = toVote(brut);
    if (vote === POUR) pour++;
    else if (vote === NEUTRE) neutre++;
    else if (vote === CONTRE) contre++;
  }

  // Le legacy compte `count($pourContre)` — toutes les entrées, y compris celles
  // dont la valeur n'est aucun des trois votes. On ne compte que les votes
  // valides : un total qui n'est pas la somme des parts rendrait les
  // pourcentages incohérents.
  const total = pour + neutre + contre;

  if (total === 0) {
    return { pour, neutre, contre, total: 0, pourPct: 0, neutrePct: 100, contrePct: 0 };
  }
  if (pour === 0 && contre === 0) {
    return { pour, neutre, contre, total, pourPct: 0, neutrePct: 100, contrePct: 0 };
  }

  // Arrondi à l'entier, avec le reste absorbé par « neutre » pour que la somme
  // fasse exactement 100 — sinon la barre de progression laisse un liseré.
  const pourPct = Math.round((pour / total) * 100);
  const contrePct = Math.round((contre / total) * 100);
  return {
    pour,
    neutre,
    contre,
    total,
    pourPct,
    neutrePct: 100 - pourPct - contrePct,
    contrePct,
  };
}

/**
 * Seuil de votes attendu, ou `null` s'il n'est pas configuré.
 *
 * ⚠️ Le legacy le lit sur `$amswer` — une coquille pour `$answer`
 * (`pourContre.php:92`) — si bien que la valeur configurée n'est JAMAIS trouvée
 * et qu'il affiche invariablement « 50% ». Ce « 50% » est donc un repli d'échec
 * déguisé en réglage, pas une valeur métier : on renvoie `null` plutôt que de le
 * reconduire, et l'appelant n'affiche alors pas la ligne.
 *
 * Le réglage lui-même reste côté legacy (précédent établi pour les
 * configurations d'admin) ; il vit sur la RÉPONSE (`answer.inputConfig`), que le
 * contexte React n'expose pas aujourd'hui.
 */
export function getMinimumVotes(
  inputConfig: { pourContre?: { minimumVotes?: unknown } } | null | undefined
): string | null {
  const brut = inputConfig?.pourContre?.minimumVotes;
  if (typeof brut === "number") return `${brut}%`;
  if (typeof brut === "string" && brut.trim() !== "") {
    return brut.trim().endsWith("%") ? brut.trim() : `${brut.trim()}%`;
  }
  return null;
}
