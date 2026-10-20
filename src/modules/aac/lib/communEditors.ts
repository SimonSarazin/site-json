/**
 * Contributeurs à l'édition d'un commun — fonctions PURES.
 *
 * Deux sources pour UNE liste :
 *  - `links.canEdit` de la réponse, que la fiche écrit (legacy `campDetail.php`
 *    `add_form_contributor`, React `CommunEditorsDialog`) et que le backend lit pour autoriser
 *    l'enregistrement (`Coform::canAdminAnswer`) ;
 *  - la question finder que le formulaire DÉCLARE comme alimentant ce lien —
 *    `params.finder<clé>.addToLinks = { value: true, links: "canEdit" }`, la question « Référent
 *    du commun » dans le gabarit AAC. Rien n'est codé en dur : sans ce réglage, pas de question.
 *
 * Les deux listes ont pu diverger (au 29/09, aucun formulaire de la base ne portait le réglage :
 * le lien était inactif) : la fiche présente leur UNION, et l'enregistrement réaligne les deux.
 * Personne n'en sort sans avoir été retiré à l'écran.
 */
import type { FinderElement } from "@/modules/coform/types";
import { collectAddToLinksFields, finderElementsOf } from "@/modules/coform/utils/addToLinks";
import { getFieldNameWithPrefix } from "@/modules/coform/utils/formParser";
import { withRelativeImageUrls } from "@/modules/coform/utils/toRelativeImageUrl";
import type { AacFormMeta } from "./formMeta";

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};

/** Le lien de la réponse qui porte les contributeurs à l'édition. */
export const EDITORS_LINK = "canEdit";

/** La question du formulaire qui alimente `links.canEdit`. */
export interface EditorsQuestion {
  stepKey: string;
  /** Libellé de la question, tel que le formulaire l'affiche. */
  label: string;
  /** Clé de stockage de la question : `finder<clé d'input>`. */
  fieldName: string;
  /** Chemin d'écriture : `answers.<étape>.<fieldName>`. */
  path: string;
}

/** Les contributeurs à l'édition, par identifiant — la forme d'une valeur de finder. */
export type CommunEditors = Record<string, FinderElement>;

/**
 * La question finder déclarée comme alimentant `links.canEdit` — à condition que le formulaire
 * la CONNAISSE : une config qui désigne une question absente n'ouvre aucune écriture.
 */
export function resolveEditorsQuestion(
  meta: AacFormMeta | null,
  params: unknown
): EditorsQuestion | null {
  if (!meta) return null;
  const declared = collectAddToLinksFields(params).filter((f) => f.linkKey === EDITORS_LINK);
  for (const { fieldName } of declared) {
    for (const question of Object.values(meta.byId)) {
      if (question.componentType !== "finder") continue;
      if (getFieldNameWithPrefix("finder", question.id) !== fieldName) continue;
      return {
        stepKey: question.stepKey,
        label: question.label,
        fieldName,
        path: `answers.${question.stepKey}.${fieldName}`,
      };
    }
  }
  return null;
}

/** Les identifiants de `links.canEdit` — ce que le calculateur de droits consomme. */
export function editorIdsOf(answer: unknown): string[] {
  return [...finderElementsOf(rec(rec(answer).links)[EDITORS_LINK]).keys()];
}

function questionValueOf(answer: unknown, question: EditorsQuestion | null): unknown {
  if (!question) return undefined;
  return rec(rec(rec(answer).answers)[question.stepKey])[question.fieldName];
}

/**
 * La liste présentée : `links.canEdit` ∪ la question. Un nom connu d'un seul côté complète
 * l'autre ; l'image n'est jamais lue ici (résolue à l'affichage, comme dans tout finder).
 */
export function readCommunEditors(answer: unknown, question: EditorsQuestion | null): CommunEditors {
  const editors: CommunEditors = {};
  const sources = [
    finderElementsOf(rec(rec(answer).links)[EDITORS_LINK]),
    finderElementsOf(questionValueOf(answer, question)),
  ];
  for (const source of sources) {
    for (const [id, el] of source) {
      const connu = editors[id];
      editors[id] = { id, name: connu?.name || el.name, type: "citoyens" };
    }
  }
  return editors;
}

/**
 * La valeur COMPLÈTE à écrire dans `links.canEdit` — `null` pour une liste vide, qui devient un
 * `$unset` (`updateField`). Les entrées déjà présentes sont conservées — vignette legacy comprise,
 * que la lecture SDK a rendue absolue et qui redevient relative ; les nouvelles prennent la forme
 * du finder legacy, `{ name, type }`.
 */
export function toEditorsLinkValue(editors: CommunEditors, answer: unknown): Record<string, Rec> | null {
  const actuel = rec(rec(rec(answer).links)[EDITORS_LINK]);
  const value: Record<string, Rec> = {};
  for (const [id, el] of Object.entries(editors)) {
    value[id] = actuel[id] && typeof actuel[id] === "object"
      ? withRelativeImageUrls(actuel[id] as Rec)
      : { name: el.name, type: el.type };
  }
  return Object.keys(value).length > 0 ? value : null;
}

/**
 * La valeur COMPLÈTE à écrire dans la question — `{ <id>: { id, name, type } }`, la forme d'une
 * valeur de finder (sans `img`, que le formulaire retire de toute façon). `null` pour une liste
 * vide. Les entrées déjà présentes sont conservées (vignettes remises en relatif).
 */
export function toEditorsQuestionValue(
  editors: CommunEditors,
  answer: unknown,
  question: EditorsQuestion
): Record<string, Rec> | null {
  const actuel = rec(questionValueOf(answer, question));
  const value: Record<string, Rec> = {};
  for (const [id, el] of Object.entries(editors)) {
    value[id] = actuel[id] && typeof actuel[id] === "object"
      ? withRelativeImageUrls(actuel[id] as Rec)
      : { id, name: el.name, type: el.type };
  }
  return Object.keys(value).length > 0 ? value : null;
}

function sameIds(editors: CommunEditors, ids: readonly string[]): boolean {
  return ids.length === Object.keys(editors).length && ids.every((id) => id in editors);
}

/**
 * Ce qu'un enregistrement doit réécrire. Une liste inchangée à l'écran peut quand même devoir
 * s'écrire : si les deux sources divergeaient, l'union affichée n'égale aucune des deux — et c'est
 * l'enregistrement qui les réaligne.
 */
export function editorsWrites(
  editors: CommunEditors,
  answer: unknown,
  question: EditorsQuestion | null
): { link: boolean; question: boolean } {
  return {
    link: !sameIds(editors, editorIdsOf(answer)),
    question: question !== null
      && !sameIds(editors, [...finderElementsOf(questionValueOf(answer, question)).keys()]),
  };
}
