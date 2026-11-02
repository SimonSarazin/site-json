/**
 * Detection de collision du tableau : la COLONNE visee par une carte est celle
 * sous le POINTEUR ; la place dans la colonne se choisit ensuite comme avant.
 *
 * POURQUOI pas `closestCorners` seul : il compare les coins du RECTANGLE de la
 * carte saisie a ceux des cibles, et ce rectangle suit le point de saisie. Prise
 * par la poignee (bord gauche), la carte s'etend a droite du pointeur et visait
 * la colonne sous lui ; prise par le titre ou un portrait (a droite), elle
 * debordait sur la colonne de GAUCHE et la visait. Sur un board-lien, la carte
 * se range a son rang canonique dans la colonne survolee : le rectangle
 * changeait alors de colonne a chaque rendu, l'apercu faisait la navette, et
 * React s'arretait sur « Maximum update depth exceeded ». Seule la poignee
 * deplacait donc vraiment la carte.
 *
 * Couvert par `tests/unit/boardCollision.test.ts`.
 */
import { closestCorners, pointerWithin, type CollisionDetection, type UniqueIdentifier } from '@dnd-kit/core';
import { isCardDragData, isColumnDragData } from './kanbanDnd';

/** Une instance par tableau : elle retient la colonne du geste en cours. */
export function createBoardCollisionDetection(): CollisionDetection {
  let last: { activeId: UniqueIdentifier; columnTargetId: UniqueIdentifier } | null = null;

  return (args) => {
    const { active, pointerCoordinates, droppableContainers, droppableRects } = args;
    /*
     * Le clavier n'a pas de pointeur : son capteur deplace le rectangle lui-meme,
     * de cible en cible, et `closestCorners` les suit. Une colonne se saisit par
     * son titre, au bord gauche : son rectangle suit deja le pointeur.
     */
    if (pointerCoordinates === null || !isCardDragData(active.data.current)) return closestCorners(args);

    // Cible de COLONNE sous le pointeur : sa zone de depot ou son triable.
    const columnHit = pointerWithin(args).find((hit) =>
      isColumnDragData(droppableContainers.find((container) => container.id === hit.id)?.data.current),
    );
    if (columnHit !== undefined) last = { activeId: active.id, columnTargetId: columnHit.id };
    // Entre deux colonnes, ou hors du tableau : la colonne du MEME geste tient,
    // plutot qu'un apercu qui revient en arriere puis repart.
    const columnTargetId = columnHit?.id ?? (last !== null && last.activeId === active.id ? last.columnTargetId : null);
    const span = columnTargetId === null ? undefined : droppableRects.get(columnTargetId);
    if (span === undefined) return [];

    /*
     * Appartenance GEOMETRIQUE a la colonne (centre horizontal dans son
     * rectangle), pas par l'ordre affiche : celui-ci est relu apres validation
     * et peut avoir un rendu de retard sur l'apercu, qui vient justement de
     * changer la carte de colonne.
     */
    return closestCorners({
      ...args,
      droppableContainers: droppableContainers.filter((container) => {
        const rect = droppableRects.get(container.id);
        if (rect === undefined) return false;
        const center = rect.left + rect.width / 2;
        return center >= span.left && center <= span.right;
      }),
    });
  };
}
