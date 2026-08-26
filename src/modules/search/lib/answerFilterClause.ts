/**
 * Filtrage d'une liste qui porte les RÉPONSES elles-mêmes (`defaultTypes: ["answers"]`).
 *
 * Les groupes `filtersByAnswers` / `filtersByPath` ont été écrits pour `/lieux`, où
 * l'élément listé (l'organisation) N'EST PAS le document qui porte la réponse : la
 * sélection y part donc en `{ _id: { $in: orgaNameArray } }`. Sur une liste d'`answers`
 * (`/creneaux`), le document listé EST la réponse — filtrer par `_id` d'organisation
 * ne peut rien rendre. Le prédicat doit porter sur le CHEMIN de la réponse.
 *
 * La table de correspondance « type d'input → prédicat » ci-dessous est un PORTAGE du
 * legacy, qui fait foi : `modules/costum/assets/js/franceTierslieux/answerDirectory.js`
 * lignes 1264-1290 (`showGenPrevAnswers`). Même ordre de tests, même sémantique, même
 * `replace` sur la PREMIÈRE occurrence.
 *
 * Pourquoi `$exists` sur une clé dotée et pas un `$in` : un `multiCheckboxPlus` stocke
 * ses libellés en CLÉS, pas en valeurs —
 * `[{"Obésité":{value,type,rank}},{"Douleurs chroniques":{…}}]` (99,994 % des 89 286
 * occurrences de la base). Un `$in` sur le chemin compare donc des objets et rend 0 ;
 * seul le test d'existence de la clé dotée matche (et il est indexé : l'index wildcard
 * `answers.$**_1` donne SUBPLAN + OR + IXSCAN).
 */

/** `type` posé dans `searchByFields` par un groupe « par réponses » ciblant les answers. */
export const ANSWER_PATH_TYPE = "answerPath";

/** Cible d'un groupe « par réponses » — cf. `FiltersByAnswersSchema.filterTarget`. */
export type AnswerFilterTarget = "answers" | "linkedElements";

/** Sous-ensemble de config nécessaire pour décider du prédicat (answers ou path). */
export interface AnswerGroupConf {
  filterTarget?: AnswerFilterTarget;
  /** `filtersByAnswers` : chemin SANS le préfixe `answers.`. */
  path?: string;
  /** `filtersByPath` : idem, sous un autre nom (cf. `useFiltersByPath`). */
  thematicPath?: string;
}

/**
 * Chemin complet du champ de réponse d'un groupe, ou `null` si le groupe ne cible pas
 * les answers (défaut historique) ou n'a pas de chemin déclaré.
 *
 * `filtersByAnswers.path` et `filtersByPath.thematicPath` sont tous deux relatifs :
 * `useFiltersByPath` préfixe déjà par `answers.` de son côté, on fait pareil ici.
 */
export function answerGroupFieldPath(conf: AnswerGroupConf | undefined): string | null {
  if (!conf || conf.filterTarget !== "answers") return null;
  const raw = conf.path ?? conf.thematicPath;
  if (!raw) return null;
  return raw.startsWith("answers.") ? raw : `answers.${raw}`;
}

/**
 * Prédicat Mongo d'UNE valeur cochée, ou `null` si la valeur est INEXPRIMABLE.
 *
 * Seul cas inexprimable : un libellé de `multiCheckboxPlus` contenant un `.`, qui
 * deviendrait un niveau de chemin supplémentaire et ne matcherait jamais — panne
 * SILENCIEUSE. 819 libellés sur 246 185 sont dans ce cas en base (« Facilitateur.rice
 * de Tiers-Lieux », « …ci-dessus. »). On rend `null` plutôt que d'émettre un filtre
 * mort ; l'appelant avertit en dev et la garde `tests/preflight` le signale.
 * (Un repli `$expr` + `$objectToArray` fonctionnerait sur Mongo 4.2 mais en COLLSCAN
 * — 182 ms contre 0 ms indexé : pas de dette pour 0,33 % des libellés.)
 *
 * Les autres branches placent le libellé en VALEUR : un point y est inoffensif.
 */
export function answerFilterClause(
  fieldPath: string,
  value: string,
): Record<string, unknown> | null {
  if (!fieldPath || !value) return null;
  if (fieldPath.includes("multiCheckboxPlus")) {
    if (value.includes(".")) return null;
    return { [`${fieldPath}.${value}`]: { $exists: true } };
  }
  if (fieldPath.includes("multiRadio")) return { [`${fieldPath}.value`]: value };
  if (fieldPath.includes("checkboxNew")) return { [fieldPath.replace("checkboxNew", "")]: value };
  if (fieldPath.includes("radioNew")) return { [fieldPath.replace("radioNew", "")]: value };
  return { [fieldPath]: value };
}

/**
 * Arguments de toggle d'une option, selon la cible du groupe. Source unique du clic
 * (`FiltersSection`) et de la lecture d'URL (`computeFiltersFromUrl`) — les deux
 * DOIVENT produire la même entrée `searchByFields`, sinon un deep-link et un clic
 * donnent des résultats différents.
 *
 * - cible `answers`        → `{ field: <chemin>, type: "answerPath", value: [libellé] }`
 * - cible historique       → `{ field: "_id", value: orgaNameArray }`
 */
export function answerToggleArgs(
  conf: AnswerGroupConf | undefined,
  optionKey: string,
  option: { name?: string; orgaNameArray?: string[] },
): { field: string; value: string[]; fieldType: string | null } {
  const fieldPath = answerGroupFieldPath(conf);
  if (fieldPath) {
    return { field: fieldPath, value: [option.name || optionKey], fieldType: ANSWER_PATH_TYPE };
  }
  return { field: "_id", value: option.orgaNameArray ?? [], fieldType: null };
}
