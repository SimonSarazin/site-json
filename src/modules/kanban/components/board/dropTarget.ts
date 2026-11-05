/**
 * Colonne visee par un survol, lue sur l'ordre AFFICHE.
 *
 * Pourquoi ne pas se contenter de `targetColumnOf(overData)` : la `dragData`
 * d'une carte porte la colonne du DERNIER instantane serveur
 * (`card.columnId`), pas celle de l'apercu en cours. Des qu'un apercu de drag a
 * deplace la carte d'une colonne a l'autre, dnd-kit continue de survoler cette
 * meme carte — qui se declare alors dans son ancienne colonne. L'apercu
 * repartait donc en arriere a la frame suivante, et le depot atterrissait dans
 * la colonne de depart.
 *
 * L'ordre affiche, lui, est la verite de ce que la personne voit : c'est lui
 * qui decide. Couvert par `tests/unit/dropTarget.test.ts`.
 */
import { columnOfCard, targetCardOf, targetColumnOf, type CardOrder } from './kanbanDnd';

export function resolveDropColumnId(order: CardOrder, overData: unknown): string | null {
  const overCardId = targetCardOf(overData);
  if (overCardId === null) return targetColumnOf(overData);
  // Repli sur la colonne declaree : une carte tout juste recue du polling peut
  // n'etre pas encore dans l'ordre affiche.
  return columnOfCard(order, overCardId) ?? targetColumnOf(overData);
}
