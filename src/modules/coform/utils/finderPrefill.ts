import type { AllStepsData } from "../types";

/** Élément présélectionné dans un finder — la forme STOCKÉE dans la réponse : `{ [id]: { id, type, name } }`. */
export interface FinderElement {
  id: string;
  type: string;
  name: string;
}

/** Chemin de finder sans l'éventuel préfixe `answers.` des configs : `<étape>.<clé du finder>`. */
function stepPath(finderPath: string): string {
  return finderPath.startsWith("answers.") ? finderPath.slice("answers.".length) : finderPath;
}

/**
 * `defaultValues` d'une NOUVELLE réponse dont le finder présélectionne `element` (ex. le lieu, la
 * structure depuis laquelle on dépose). `finderPath` accepte les deux formes des configs :
 * `answers.<étape>.<clé>` ou `<étape>.<clé>`. Le préremplissage se fait côté client — jamais en
 * pré-créant une réponse en base, qui resterait orpheline si l'utilisateur annule.
 */
export function buildFinderDefaultValues(finderPath: string, element: FinderElement): AllStepsData {
  const value = { [element.id]: { id: element.id, type: element.type, name: element.name } };
  return stepPath(finderPath)
    .split(".")
    .reduceRight<Record<string, unknown>>((acc, part) => ({ [part]: acc }), value) as AllStepsData;
}

/**
 * Nom du champ finder dans le formulaire (`field.name`, préfixe de type compris) : le dernier
 * segment du chemin — la clé qu'attendent `lockedFields` et `hiddenFields`.
 */
export function finderFieldName(finderPath: string): string {
  return finderPath.split(".").pop() ?? "";
}
