/**
 * GARDE DE LA CIBLE AU POINTEUR (`createBoardCollisionDetection`).
 *
 * Une carte saisie par sa droite (titre, portrait) a un rectangle qui deborde
 * sur la colonne de gauche : `closestCorners` seul visait cette colonne, et sur
 * un board-lien l'apercu faisait la navette jusqu'a « Maximum update depth
 * exceeded ». La colonne visee doit etre celle sous le pointeur, quel que soit
 * le point de saisie.
 *
 * Geometrie : trois colonnes de 300 px separees de 16 px, la troisieme vide.
 */
import { closestCorners, type Active, type ClientRect, type DroppableContainer, type UniqueIdentifier } from '@dnd-kit/core';
import { describe, expect, it } from 'vitest';
import { createBoardCollisionDetection } from '@/modules/kanban/components/board/boardCollision';

function rect(left: number, top: number, width: number, height: number): ClientRect {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

const column = (columnId: string) => ({ type: 'column', columnId });
const card = (cardId: string, columnId: string) => ({ type: 'card', cardId, columnId });

const LAYOUT: ReadonlyArray<[string, Record<string, string>, ClientRect]> = [
  ['column:col-a', column('col-a'), rect(0, 0, 300, 600)],
  ['zone:col-a', column('col-a'), rect(8, 50, 284, 500)],
  ['a1', card('a1', 'col-a'), rect(8, 50, 284, 80)],
  ['a2', card('a2', 'col-a'), rect(8, 140, 284, 80)],
  ['column:col-b', column('col-b'), rect(316, 0, 300, 600)],
  ['zone:col-b', column('col-b'), rect(324, 50, 284, 500)],
  ['b1', card('b1', 'col-b'), rect(324, 50, 284, 80)],
  ['b2', card('b2', 'col-b'), rect(324, 140, 284, 80)],
  // Posee dans « col-b » par l'apercu, mais ses donnees disent encore « col-a ».
  ['moved', card('moved', 'col-a'), rect(324, 230, 284, 80)],
  ['column:col-c', column('col-c'), rect(632, 0, 300, 600)],
  ['zone:col-c', column('col-c'), rect(640, 50, 284, 500)],
];

const droppableContainers: DroppableContainer[] = LAYOUT.map(([id, data]) => ({
  id,
  key: id,
  data: { current: data },
  disabled: false,
  node: { current: null },
  rect: { current: null },
}));
const droppableRects = new Map<UniqueIdentifier, ClientRect>(LAYOUT.map(([id, , box]) => [id, box]));

function active(id: string, data: Record<string, string>): Active {
  return { id, data: { current: data }, rect: { current: { initial: null, translated: null } } };
}

const CARD_A2 = active('a2', card('a2', 'col-a'));

/** Carte de 284 px saisie a 260 px de son bord gauche : son rectangle est a gauche du pointeur. */
function args(pointer: { x: number; y: number } | null, dragged: Active = CARD_A2) {
  const x = pointer?.x ?? 400;
  const y = pointer?.y ?? 100;
  return {
    active: dragged,
    collisionRect: rect(x - 260, y - 40, 284, 80),
    droppableRects,
    droppableContainers,
    pointerCoordinates: pointer,
  };
}

const firstId = (collisions: ReadonlyArray<{ id: UniqueIdentifier }>) => collisions[0]?.id;

describe('createBoardCollisionDetection', () => {
  it('saisie par la droite : la colonne visee est celle du pointeur, pas celle du rectangle', () => {
    const input = args({ x: 400, y: 100 });
    // Le defaut corrige : le rectangle seul visait la colonne de gauche.
    expect(firstId(closestCorners(input))).toBe('a1');
    expect(firstId(createBoardCollisionDetection()(input))).toBe('b1');
  });

  it('une carte deplacee par l apercu appartient a la colonne ou elle est DESSINEE', () => {
    expect(firstId(createBoardCollisionDetection()(args({ x: 400, y: 270 })))).toBe('moved');
  });

  it('colonne vide : sa zone de depot', () => {
    expect(firstId(createBoardCollisionDetection()(args({ x: 700, y: 100 })))).toBe('zone:col-c');
  });

  it('clavier (aucun pointeur) : la detection d origine, inchangee', () => {
    const input = args(null);
    expect(createBoardCollisionDetection()(input)).toEqual(closestCorners(input));
  });

  it('colonne saisie : la detection d origine, inchangee', () => {
    const input = args({ x: 400, y: 100 }, active('column:col-a', column('col-a')));
    expect(createBoardCollisionDetection()(input)).toEqual(closestCorners(input));
  });

  it('pointeur entre deux colonnes : la colonne du MEME geste tient, un autre geste n en herite pas', () => {
    const detect = createBoardCollisionDetection();
    expect(firstId(detect(args({ x: 400, y: 100 })))).toBe('b1');
    const inGap = detect(args({ x: 308, y: 100 }));
    expect(['b1', 'b2', 'moved', 'zone:col-b', 'column:col-b']).toContain(firstId(inGap));
    expect(detect(args({ x: 308, y: 100 }, active('a1', card('a1', 'col-a'))))).toEqual([]);
  });
});
