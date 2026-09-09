/**
 * Helpers purs de l'input `tpls.forms.aap.selection` — la grille de notation
 * d'un jury sur une candidature AAP.
 *
 * Ce n'est pas un champ de formulaire ordinaire : la valeur est scopée par
 * ÉVALUATEUR (`answers.<étape>.selection.<userId>.<critère>`) et s'écrit par
 * chemin ciblé, jamais par soumission — le backend ne deep-merge que les clés
 * suffixées `_multiEval` (`SaveAnswerAction:214`), si bien que soumettre la clé
 * entière effacerait les notes de tous les autres évaluateurs (654 réponses en
 * base). D'où des helpers purs ici, et zéro entrée au schéma Zod.
 *
 * Toutes les règles ci-dessous sont relevées sur `selection.php` et vérifiées
 * contre les données réelles de `pixelhumain1`.
 */
import { toSafeInt } from "@/modules/cagnotte/utils/dataTransform";

/**
 * Étape de DÉPÔT, dont les réponses alimentent la colonne « réponse du candidat ».
 *
 * Le legacy la lit en dur (`selection.php:85` : `"step" => "aapStep1"`), et c'est
 * la convention de tout le module AAC. Nommée ici pour que le littéral ne se
 * disperse pas d'un composant à l'autre.
 */
export const DEPOSIT_STEP_ID = "aapStep1";

/** Type de vote. `starCriterionBased` est le défaut quand la config est muette. */
export type SelectionVoteType = "starCriterionBased" | "noteCriterionBased";

export interface SelectionCriterion {
  /** Clé du critère — clé d'une question de l'étape 1, ou clé libre. */
  fieldKey: string;
  /** Libellé affiché : `fieldLabel` de la config, sinon le label de la question. */
  label: string;
  /** Coefficient de pondération (cf. `normalizeCoeff`). */
  coeff: number;
  /** Critère « libre » : sans question associée, donc sans valeur candidat. */
  isFree: boolean;
}

export interface SelectionConfig {
  voteType: SelectionVoteType;
  noteMax: number;
  criteria: SelectionCriterion[];
  showAdmissibility: boolean;
}

/** Forme brute de `form.params.configSelectionCriteria`. */
export interface RawSelectionConfig {
  type?: unknown;
  noteMax?: unknown;
  criterions?: unknown;
  unassociatedCriterions?: unknown;
  admissibility?: unknown;
}

/**
 * Coefficient d'un critère, à la règle EXACTE du legacy : `is_int($coeff) ? $coeff : 1`.
 *
 * Conséquence à ne pas « corriger » : un coeff stocké en chaîne (`"3"`) n'est pas
 * un entier PHP, il retombe donc à 1 — et c'est cette valeur-là qui a servi à
 * calculer les moyennes déjà en base. Relevé : sur 105 critères, 23 portent un
 * coeff en chaîne, 3 valent `null`, et 13 sont réellement pondérants (2 ou 3).
 * Interpréter `"3"` comme 3 ici ferait diverger React du legacy sur des notes
 * existantes, sans que personne n'ait rien changé.
 */
export function normalizeCoeff(coeff: unknown): number {
  return Number.isInteger(coeff) ? (coeff as number) : 1;
}

/**
 * Note exploitable à partir d'une valeur stockée. Relevé sur 6028 notes :
 * 5975 nombres, 52 chaînes, 1 booléen — la coercion n'est pas théorique.
 */
export function toNote(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Itère une liste de critères qui peut être un tableau ou un objet indexé. */
function eachCriterion(source: unknown): Record<string, unknown>[] {
  if (!source || typeof source !== "object") return [];
  return Object.values(source as Record<string, unknown>).filter(
    (v): v is Record<string, unknown> => !!v && typeof v === "object"
  );
}

/**
 * Lit `params.configSelectionCriteria`.
 *
 * - `type` vide ou absent → `starCriterionBased` (relevé : 12 formulaires sur 16) ;
 * - en mode étoiles, `noteMax` est FORCÉ à 5, quoi que dise la config ;
 * - `admissibility` n'est faux que s'il vaut explicitement `false`.
 *
 * `labels` fournit le libellé des questions de l'étape 1, pour les critères qui
 * y sont associés (le legacy le lit dans le document d'inputs de `aapStep1`).
 */
export function parseSelectionConfig(
  raw: RawSelectionConfig | null | undefined,
  labels: Record<string, string> = {}
): SelectionConfig {
  const cfg = raw ?? {};

  const voteType: SelectionVoteType =
    cfg.type === "noteCriterionBased" ? "noteCriterionBased" : "starCriterionBased";

  // `noteMax` arrive parfois en chaîne vide : le legacy le traite comme absent.
  const rawMax = typeof cfg.noteMax === "string" ? parseFloat(cfg.noteMax) : cfg.noteMax;
  const noteMax =
    voteType === "starCriterionBased"
      ? 5
      : typeof rawMax === "number" && Number.isFinite(rawMax) && rawMax > 0
        ? rawMax
        : 10;

  const criteria: SelectionCriterion[] = [];
  const pousser = (crit: Record<string, unknown>, isFree: boolean) => {
    const fieldKey = typeof crit.fieldKey === "string" ? crit.fieldKey : "";
    if (!fieldKey) return; // le legacy ignore un critère sans `fieldKey`
    const fieldLabel = typeof crit.fieldLabel === "string" ? crit.fieldLabel : "";
    criteria.push({
      fieldKey,
      label: fieldLabel || labels[fieldKey] || fieldKey,
      coeff: normalizeCoeff(crit.coeff),
      isFree,
    });
  };
  eachCriterion(cfg.criterions).forEach((c) => pousser(c, false));
  eachCriterion(cfg.unassociatedCriterions).forEach((c) => pousser(c, true));

  return {
    voteType,
    noteMax,
    criteria,
    showAdmissibility: cfg.admissibility !== false,
  };
}

/** Notes d'un évaluateur : `{ <critère>: note }`. */
export type SelectionNotes = Record<string, unknown>;
/** Valeur complète de la clé `selection` : `{ <userId>: notes }`. */
export type SelectionValue = Record<string, SelectionNotes>;

export interface SelectionMeans {
  /** Moyenne pondérée de l'utilisateur courant, ou `null` s'il n'a pas voté. */
  myMean: number | null;
  /** Moyenne de toutes les moyennes d'évaluateurs, ou `null` si personne n'a voté. */
  allMean: number | null;
  /** Nombre d'évaluateurs ayant une entrée. */
  evaluatorCount: number;
}

/** Arrondi à 3 décimales, comme `Number(x.toFixed(3))` côté legacy. */
function arrondir(n: number): number {
  return Number(n.toFixed(3));
}

/**
 * Moyennes « mon vote » et « tous les votants », à l'identique du legacy :
 *
 *   moyenne(u) = Σ note[u][k] × coeff[k] / Σ coeff[k]
 *
 * — le dénominateur est la somme des coefficients de TOUS les critères
 * configurés, pas seulement de ceux que l'évaluateur a notés : un critère laissé
 * vide tire donc la moyenne vers le bas. C'est le comportement d'origine, et les
 * `allVotes` déjà en base ont été calculés ainsi.
 *
 * Seules les clés présentes dans la config comptent au numérateur : une note
 * orpheline (critère retiré depuis) est ignorée, comme dans le legacy
 * (`if (exists(keyCoeff[kk]))`).
 *
 * Garde ajoutée : sans critère configuré, `sumCoeff` vaut 0 et le legacy
 * produirait `NaN`/`Infinity`. Or 76 formulaires utilisent `selection` SANS
 * `configSelectionCriteria` — on renvoie `null`, qui s'affiche comme « pas de
 * note » au lieu d'un « NaN » à l'écran.
 */
export function computeSelectionMeans(
  selection: SelectionValue | null | undefined,
  criteria: SelectionCriterion[],
  currentUserId: string | null | undefined
): SelectionMeans {
  const coeffByKey: Record<string, number> = {};
  let sumCoeff = 0;
  for (const c of criteria) {
    coeffByKey[c.fieldKey] = c.coeff;
    sumCoeff += c.coeff;
  }

  const entries = selection && typeof selection === "object" ? Object.entries(selection) : [];
  if (sumCoeff <= 0 || entries.length === 0) {
    return { myMean: null, allMean: null, evaluatorCount: entries.length };
  }

  let myMean: number | null = null;
  let total = 0;
  for (const [userId, notes] of entries) {
    let current = 0;
    if (notes && typeof notes === "object") {
      for (const [key, value] of Object.entries(notes)) {
        const coeff = coeffByKey[key];
        if (coeff === undefined) continue; // critère retiré de la config
        current += toNote(value) * coeff;
      }
    }
    current = current / sumCoeff;
    if (currentUserId && userId === currentUserId) myMean = arrondir(current);
    total += current;
  }

  return {
    myMean,
    allMean: arrondir(total / entries.length),
    evaluatorCount: entries.length,
  };
}

/**
 * Valeur du candidat affichée en regard d'un critère (colonne « Valeur »).
 *
 * `depense` et `budget` sont traités à part : ce sont des listes de lignes, dont
 * le legacy affiche la SOMME des prix et non le contenu. Un tableau ordinaire
 * est listé, un scalaire affiché tel quel, tout le reste rendu vide.
 *
 * Les prix passent par `toSafeInt`, le lecteur UNIQUE des montants sur un
 * document — pas par `toNote`, qui est fait pour des notes : `"1 500,00"` y
 * valait 1 et `true` 1, alors que `depense[].price` arrive en chaîne sur 178
 * réponses et en booléen sur 75.
 */
export function formatCriterionValue(fieldKey: string, value: unknown): string {
  if (fieldKey === "depense" || fieldKey === "budget") {
    if (!value || typeof value !== "object") return "0";
    let total = 0;
    for (const ligne of Object.values(value as Record<string, unknown>)) {
      if (ligne && typeof ligne === "object") {
        total += toSafeInt((ligne as Record<string, unknown>).price);
      }
    }
    return String(total);
  }
  if (Array.isArray(value)) return value.map((v) => String(v)).join("\n");
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}
