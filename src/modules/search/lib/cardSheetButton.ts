import type { ListConf } from "../schema";

/**
 * Variants de carte qui savent afficher le bouton « Fiche » (`onOpenSheet`).
 *
 * Le tableau de bord embarqué (`onSelectItem`) détourne le clic vers la SÉLECTION :
 * il n'est sûr que si la carte offre une autre porte vers la fiche. Ailleurs, le
 * clic garde son comportement normal — sans quoi la fiche deviendrait inaccessible.
 * Ajouter un variant ici UNIQUEMENT s'il rend effectivement le bouton.
 */
const SHEET_BUTTON_CARD_TYPES = new Set(["poi-amenities"]);

/** Même clé de dispatch que `SearchCard` (`card.variant || card.type`). */
export function cardHasSheetButton(card?: ListConf["card"]): boolean {
  const cardType = card?.variant || card?.type;
  return cardType != null && SHEET_BUTTON_CARD_TYPES.has(cardType);
}
