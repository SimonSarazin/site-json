/**
 * Reperage, dans le DOM, d'une carte RENDUE et de l'element qui recoit son
 * focus — partage par la colonne (focus apres « Afficher N de plus » ou un
 * archivage) et le tableau (focus apres un depot au clavier), qui recopiaient
 * la meme boucle. Teste dans `tests/unit/cardFocus.test.ts`.
 */

/**
 * Fiche rendue d'une carte dans `root`. Par comparaison du `data-card-id` et
 * non par un selecteur construit : un identifiant n'a pas a etre echappe.
 */
export function cardElementIn(root: ParentNode | null, cardId: string): HTMLElement | null {
  if (root === null) return null;
  for (const element of root.querySelectorAll<HTMLElement>('[data-card-id]')) {
    if (element.dataset.cardId === cardId) return element;
  }
  return null;
}

/**
 * Element d'une carte rendue qui doit recevoir le focus : sa POIGNEE clavier
 * (premier arret de la carte pour qui peut la deplacer), sinon le LIEN de son
 * titre — le seul arret d'une carte en lecture seule, qui n'a pas de poignee.
 * Sans ce repli, le focus d'un lecteur sautait au menu de la colonne, tout en
 * haut, loin des cartes qu'il venait d'afficher.
 */
export function cardFocusTargetIn(root: ParentNode | null, cardId: string): HTMLElement | null {
  const card = cardElementIn(root, cardId);
  if (card === null) return null;
  return card.querySelector<HTMLElement>('[data-card-handle]') ?? card.querySelector<HTMLElement>('a[href]');
}

/**
 * LIEN d'une carte rendue, celui qui ouvre sa fiche et doit retrouver le focus quand elle se
 * ferme : la carte elle-même quand toute sa ligne est un lien (Liste, Table, Chronologie), sinon
 * le lien de son titre (Tableau, vue Jalons).
 */
export function cardLinkIn(root: ParentNode | null, cardId: string): HTMLElement | null {
  const card = cardElementIn(root, cardId);
  if (card === null) return null;
  return card.matches('a[href]') ? card : card.querySelector<HTMLElement>('a[href]');
}
