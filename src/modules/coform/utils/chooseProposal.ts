/**
 * Helpers purs de l'input `tpls.forms.aap.chooseProposal` — « sélectionné pour
 * l'afficher dans l'annuaire ».
 *
 * Une différence majeure avec ses voisins : la valeur n'est pas scopée par
 * ÉVALUATEUR mais par CONTEXTE (l'organisation porteuse de l'appel) :
 *
 *   answers.<étape>.choose.<contextId> = { value, type, name }
 *
 * Une même candidature peut donc être retenue par un appel et pas par un autre.
 * Ce n'est pas théorique : sur les 59 réponses relevées en base, **9 portent 2 ou
 * 3 contextes**. Aplatir en booléen — ou soumettre la clé avec le formulaire —
 * effacerait les choix de tous les autres contextes, le backend remplaçant en
 * bloc toute clé non suffixée `_multiEval`.
 *
 * D'où, comme pour `selection`, une écriture par chemin ciblé et zéro entrée au
 * schéma Zod.
 */
import { firstParent } from "@/modules/aac/lib/formParent";

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

/** Le contexte sous lequel le choix s'écrit — cf. `resolveChooseContext`. */
export interface ChooseContext {
  id: string;
  type?: string | null;
  name?: string | null;
}

/**
 * Le contexte sous lequel `choose` s'écrit ET se lit : la 1re entrée de
 * `form.parent` — l'organisation porteuse de l'appel.
 *
 * C'est la clé qu'emploie le backend AAP, et celle sur laquelle l'annuaire du
 * module AAC filtre (`aacQueryParams`, via `aacConfigQuery` → `firstParent`).
 * Le legacy la résolvait depuis le costum ; l'entité du slug du site peut en
 * diverger (formulaire porté par plusieurs parents, ou par une autre
 * organisation que celle du site) — écrire sous elle enregistrerait sans erreur
 * un choix que personne ne lirait. Une seule fonction pour les deux lectures,
 * sinon elles dérivent : on délègue au helper du module AAC.
 *
 * @param formData - `CoFormData` (le `serverData` du form), ou tout objet à `parent`.
 * @returns le contexte, ou `null` si le formulaire n'a pas de parent exploitable.
 */
export function resolveChooseContext(formData: unknown): ChooseContext | null {
  return firstParent(formData);
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
