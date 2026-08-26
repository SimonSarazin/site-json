/**
 * Helpers purs de l'input `tpls.forms.aap.chooseProposal` — « sélectionné pour
 * l'afficher dans l'annuaire ».
 *
 * Une différence majeure avec ses voisins : la valeur n'est pas scopée par
 * ÉVALUATEUR mais par CONTEXTE (le costum qui affiche le formulaire) :
 *
 *   answers.<étape>.choose.<contextId> = { value, type, name }
 *
 * Une même candidature peut donc être retenue par un costum et pas par un autre.
 * Ce n'est pas théorique : sur les 59 réponses relevées en base, **9 portent 2 ou
 * 3 contextes**. Aplatir en booléen — ou soumettre la clé avec le formulaire —
 * effacerait les choix de tous les autres costums, le backend remplaçant en bloc
 * toute clé non suffixée `_multiEval`.
 *
 * D'où, comme pour `selection`, une écriture par chemin ciblé et zéro entrée au
 * schéma Zod.
 */

export const SELECTED = "selected";
export const NOT_SELECTED = "notselected";

/** Une entrée par contexte. `type` et `name` sont dénormalisés à l'écriture. */
export interface ChooseEntry {
  value?: unknown;
  type?: unknown;
  name?: unknown;
}

/** `{ <contextId>: { value, type, name } }`. */
export type ChooseProposalValue = Record<string, ChooseEntry | undefined>;

/** Le contexte courant, tel que le legacy le résout depuis `costum`/`contextData`. */
export interface ChooseContext {
  id: string;
  type?: string | null;
  name?: string | null;
}

/**
 * La candidature est-elle retenue DANS CE CONTEXTE ?
 *
 * Le legacy compare strictement à `"selected"` et considère tout le reste comme
 * non retenu (`chooseProposal.php:175`) — y compris l'absence d'entrée, ce qui
 * est le comportement voulu : par défaut, une candidature n'est pas publiée.
 */
export function isSelectedIn(
  value: ChooseProposalValue | null | undefined,
  contextId: string | null | undefined
): boolean {
  if (!value || typeof value !== "object" || !contextId) return false;
  return value[contextId]?.value === SELECTED;
}

/** Nom du contexte tel que stocké lors du dernier choix, s'il y en a un. */
export function getStoredContextName(
  value: ChooseProposalValue | null | undefined,
  contextId: string | null | undefined
): string | null {
  if (!value || typeof value !== "object" || !contextId) return null;
  const nom = value[contextId]?.name;
  return typeof nom === "string" && nom.trim() !== "" ? nom : null;
}

/**
 * Les AUTRES contextes où la candidature est retenue.
 *
 * Le legacy n'en dit rien : il n'affiche que le contexte courant, si bien qu'un
 * administrateur ne voit pas qu'il décide pour un costum parmi plusieurs. Les
 * exposer évite de croire qu'on désélectionne partout.
 */
export function getOtherSelections(
  value: ChooseProposalValue | null | undefined,
  contextId: string | null | undefined
): { id: string; name: string }[] {
  if (!value || typeof value !== "object") return [];
  const autres: { id: string; name: string }[] = [];
  for (const [id, entree] of Object.entries(value)) {
    if (id === contextId) continue;
    if (entree?.value !== SELECTED) continue;
    const nom = typeof entree.name === "string" && entree.name.trim() !== "" ? entree.name : id;
    autres.push({ id, name: nom });
  }
  return autres;
}

/**
 * Valeur à écrire. Le legacy enregistre l'objet complet — pas seulement le
 * choix — pour que le nom du contexte reste lisible sans jointure
 * (`chooseProposal.php:190-196`).
 */
export function buildChooseEntry(
  contexte: ChooseContext,
  selected: boolean
): { value: string; type: string | null; name: string | null } {
  return {
    value: selected ? SELECTED : NOT_SELECTED,
    type: contexte.type ?? null,
    name: contexte.name ?? null,
  };
}
