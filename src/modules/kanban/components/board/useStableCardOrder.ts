import { useState } from 'react';
import { reuseUnchangedColumns, type CardOrder } from './kanbanDnd';

/**
 * Ordre des cartes dont chaque colonne garde la MEME reference tant que son
 * contenu ne change pas (cf. `reuseUnchangedColumns`).
 *
 * L'ordre precedent est garde dans un ETAT ajuste pendant le rendu (« stocker
 * une information des rendus precedents » de la doc React) : une ref lue
 * pendant le rendu serait refusee par le compilateur React, un effet
 * arriverait un rendu trop tard — les colonnes se seraient deja rendues.
 * L'ajustement ne relance le rendu que lorsqu'une colonne change vraiment.
 */
export function useStableCardOrder(next: CardOrder): CardOrder {
  const [stable, setStable] = useState(next);
  const merged = reuseUnchangedColumns(stable, next);
  if (merged !== stable) setStable(merged);
  return merged;
}
