/**
 * Rangs fractionnaires — miroir CLIENT du calcul serveur (blueprint §5).
 *
 * Le serveur reste l'arbitre : le client envoie une INTENTION
 * (`beforeCardId` / `afterCardId`) et le serveur calcule le rang definitif.
 * Ce module ne sert qu'a l'affichage optimiste — il doit donner le meme
 * resultat que `KanbanRank` cote PHP, sinon la carte saute de place quand la
 * reponse arrive.
 *
 * Trois pieges traites ici :
 *  - Mongo n'a AUCUN tri stable : sans `_id` en depart de nez, deux elements de
 *    meme rang changent d'ordre d'une requete a l'autre ;
 *  - l'insertion repetee entre deux voisins epuise la precision du double ;
 *    au-dela on renumerote, on ne tronque jamais en silence ;
 *  - les doubles finissent par « coller » : `(a+b)/2 === a` bien avant que
 *    l'ecart `b-a` n'atteigne zero. Les deux cas declenchent la renumerotation.
 */

/** Pas d'insertion en tete/queue (identique au `STEP` du serveur). */
export const RANK_STEP = 1000;

/** En deca de cet ecart, on renumerote la colonne entiere. */
export const RANK_EPSILON = 0.0001;

export interface Ranked {
  _id: string;
  rank: number;
}

/** Tri canonique `{rank: 1, _id: 1}` — le meme des deux cotes. */
export function compareByRank(a: Ranked, b: Ranked): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
}

/** Copie triee : les tableaux venant du cache ne sont jamais mutes. */
export function sortByRank<T extends Ranked>(items: readonly T[]): T[] {
  return [...items].sort(compareByRank);
}

/**
 * Faut-il renumeroter avant d'inserer entre `low` et `high` ?
 *
 * `middle === low || middle === high` attrape l'epuisement de precision du
 * double, qui survient AVANT que l'ecart ne devienne nul.
 */
export function needsRenumber(low: number, high: number): boolean {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return true;
  const gap = Math.abs(high - low);
  if (gap < RANK_EPSILON) return true;
  const middle = (low + high) / 2;
  return middle === low || middle === high;
}

/** Rang d'un element pose en tete de liste. */
export function rankFirst(items: readonly Ranked[]): number {
  const sorted = sortByRank(items);
  return sorted.length === 0 ? RANK_STEP : sorted[0].rank - RANK_STEP;
}

/** Rang d'un element pose en queue de liste. */
export function rankLast(items: readonly Ranked[]): number {
  const sorted = sortByRank(items);
  return sorted.length === 0 ? RANK_STEP : sorted[sorted.length - 1].rank + RANK_STEP;
}

/** Rang strictement entre deux voisins (moyenne, comme le serveur). */
export function rankBetween(low: number, high: number): number {
  return (low + high) / 2;
}

export interface RankPlacement {
  /** Rang optimiste, a remplacer par celui du serveur des sa reponse. */
  rank: number;
  /** Le serveur va devoir renumeroter la liste : ne pas s'attacher au rang. */
  needsRenumber: boolean;
  /** Intention envoyee au serveur : « juste avant cet element ». */
  beforeId?: string;
  /** Intention envoyee au serveur : « juste apres cet element ». */
  afterId?: string;
}

/**
 * Traduit une position d'interface (index de depot dnd-kit) en rang + intention.
 *
 * `siblings` = les elements de la colonne de destination, SANS l'element
 * deplace : c'est la liste telle qu'elle sera juste avant l'insertion, donc la
 * meme base de calcul que le serveur.
 */
export function placeAt(siblings: readonly Ranked[], index: number): RankPlacement {
  const sorted = sortByRank(siblings);
  if (sorted.length === 0) {
    return { rank: RANK_STEP, needsRenumber: false };
  }

  const position = Math.max(0, Math.min(index, sorted.length));

  if (position === 0) {
    const next = sorted[0];
    return { rank: next.rank - RANK_STEP, needsRenumber: false, beforeId: next._id };
  }

  if (position >= sorted.length) {
    const previous = sorted[sorted.length - 1];
    return { rank: previous.rank + RANK_STEP, needsRenumber: false, afterId: previous._id };
  }

  const previous = sorted[position - 1];
  const next = sorted[position];
  return {
    rank: rankBetween(previous.rank, next.rank),
    needsRenumber: needsRenumber(previous.rank, next.rank),
    beforeId: next._id,
    afterId: previous._id,
  };
}

/**
 * Meme calcul, exprime par un voisin plutot que par un index — utile au clavier
 * (« deplacer avant/apres cette carte ») ou l'index n'est pas manipule.
 */
export function placeRelativeTo(
  siblings: readonly Ranked[],
  anchorId: string,
  side: 'before' | 'after',
): RankPlacement {
  const sorted = sortByRank(siblings);
  const index = sorted.findIndex((item) => item._id === anchorId);
  // Ancre inconnue (element deja deplace par quelqu'un d'autre) : la queue est
  // la seule position qui ne reordonne rien d'autre.
  if (index === -1) return placeAt(sorted, sorted.length);
  return placeAt(sorted, side === 'before' ? index : index + 1);
}
