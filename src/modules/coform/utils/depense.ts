/**
 * Helpers purs du champ « liste de dépenses / paliers »
 * (`tpls.forms.ocecoform.newDepenseList`).
 *
 * Isolés de React pour être testables directement, comme `utils/tags.ts` et
 * `utils/simpleTable.ts`.
 *
 * ⚠️ **Toutes les fonctions préservent les clés hors contrat.** Une entrée réelle
 * porte bien plus que ce que le champ édite : `financer[]` (contributions),
 * `historique[]` (journal des montants), `milestone` (lien vers le palier du
 * projet)… Les strip reviendrait à détruire de la donnée en base au premier
 * enregistrement, le backend remplaçant la clé en bloc
 * (`SaveAnswerAction` : `$mergedAnswers[$step][$input] = $inputValue`).
 * C'est exactement le piège déjà rencontré sur `timeSlots`.
 */
import { toSafeInt } from "@/modules/cagnotte/utils/dataTransform";

/**
 * Une ligne de dépense telle que persistée dans `answers.<step>.depense[]`.
 * L'index signature est délibéré : cf. l'avertissement ci-dessus.
 */
export interface DepenseEntry {
  /** Libellé de la dépense (le legacy l'appelle « poste »). */
  poste: string;
  /**
   * Montant cible — la clé `price`, en nombre. `priceInt` n'est JAMAIS stocké
   * (0 document sur 2 803) : c'est un champ calculé par l'enveloppe seulement.
   */
  price: number;
  date?: string;
  user?: string;
  /** Id du palier correspondant côté projet (`oceco.milestones[].milestoneId`). */
  milestone?: string;
  financer?: unknown[];
  historique?: unknown[];
  /** `false` = palier clôturé. Absent ⇒ actif (convention legacy). */
  include?: boolean;
  [key: string]: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Montant d'une ligne de dépense — `toSafeInt`, le lecteur UNIQUE des montants
 * sur un document, sous le nom que le champ connaît.
 *
 * Un `Number(value)` local rendait `NaN` — donc 0 — sur `"1 500,00"` et
 * `"1 500.00"` (l'espace de milliers), et 1 sur `true` ; or `depense[].price`
 * arrive en chaîne sur 178 réponses et en booléen sur 75. Accepte `"12"`, `12`,
 * `12.7` (tronqué), `"1 500,00"` ; bool, `null` et le reste valent 0.
 */
export function toDepenseAmount(value: unknown): number {
  return toSafeInt(value);
}

/**
 * Normalise une valeur serveur en liste exploitable.
 *
 * Absorbe le `{}` que PHP sérialise pour un tableau vide. `priceInt` n'existe
 * sur aucun document ; il n'est lu qu'au cas où une ligne passée ici sortirait
 * d'une réponse d'enveloppe, où il fait autorité (`priceInt ?? price`).
 */
export function normalizeDepenseValue(value: unknown): DepenseEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((raw) => ({
    ...raw,
    poste: typeof raw.poste === "string" ? raw.poste : "",
    price: toDepenseAmount(raw.priceInt ?? raw.price),
  })) as DepenseEntry[];
}

/** Une dépense est active tant qu'elle n'est pas explicitement exclue. */
export function isDepenseOpen(entry: DepenseEntry): boolean {
  return entry.include !== false;
}

/**
 * Ajoute une dépense en fin de liste.
 *
 * `milestone` est généré par le CALLER (`generateMilestoneId`) pour que le même
 * id serve des deux côtés — la ligne de dépense ici, et le palier du projet
 * quand une projection est possible.
 */
export function addDepense(
  list: DepenseEntry[],
  entry: { poste: string; price: number; description?: string; milestone: string; user?: string; date?: string },
): DepenseEntry[] {
  const poste = entry.poste.trim();
  if (!poste) return list;
  return [
    ...list,
    {
      poste,
      price: toDepenseAmount(entry.price),
      description: entry.description ?? "",
      milestone: entry.milestone,
      user: entry.user ?? "",
      date: entry.date ?? "",
      financer: [],
    },
  ];
}

/**
 * Met à jour une ligne, en ne touchant QUE les clés fournies.
 *
 * Retourne la liste d'origine (même référence) si l'index est hors bornes ou si
 * rien ne change — pour qu'un `onChange` inutile ne salisse pas l'état du form.
 */
export function updateDepense(
  list: DepenseEntry[],
  index: number,
  patch: Partial<Pick<DepenseEntry, "poste" | "price" | "description">>,
): DepenseEntry[] {
  if (index < 0 || index >= list.length) return list;
  const cible = list[index];
  const next: DepenseEntry = { ...cible };
  if (patch.poste !== undefined) next.poste = String(patch.poste).trim();
  if (patch.price !== undefined) next.price = toDepenseAmount(patch.price);
  if (patch.description !== undefined) next.description = patch.description;
  const inchange =
    next.poste === cible.poste &&
    next.price === cible.price &&
    next.description === cible.description;
  if (inchange) return list;
  const copie = [...list];
  copie[index] = next;
  return copie;
}

/** Clôture (`include:false`) ou réactive (`include:true`) une ligne. */
export function setDepenseOpen(list: DepenseEntry[], index: number, open: boolean): DepenseEntry[] {
  if (index < 0 || index >= list.length) return list;
  if (isDepenseOpen(list[index]) === open) return list;
  const copie = [...list];
  copie[index] = { ...list[index], include: open };
  return copie;
}

/** Retire une ligne. Retourne la liste d'origine si l'index est hors bornes. */
export function removeDepense(list: DepenseEntry[], index: number): DepenseEntry[] {
  if (index < 0 || index >= list.length) return list;
  return list.filter((_, i) => i !== index);
}
