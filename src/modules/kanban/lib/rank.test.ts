import { describe, expect, test } from 'vitest';
import {
  RANK_STEP,
  compareByRank,
  needsRenumber,
  placeAt,
  placeRelativeTo,
  rankBetween,
  rankFirst,
  rankLast,
  sortByRank,
  type Ranked,
} from '@/modules/kanban/lib/rank';

const item = (id: string, rank: number): Ranked => ({ _id: id, rank });

describe('tri canonique', () => {
  test('departage deux rangs egaux par `_id`', () => {
    // Sans ce depart de nez, deux elements ex aequo changent d'ordre d'une
    // requete Mongo a l'autre : les cartes « sautent » sans raison.
    const a = item('aaa', 1000);
    const b = item('bbb', 1000);
    expect(compareByRank(a, b)).toBeLessThan(0);
    expect(compareByRank(b, a)).toBeGreaterThan(0);
    expect(compareByRank(a, a)).toBe(0);
  });

  test('sortByRank ne mute pas la liste source', () => {
    const source = [item('c', 3000), item('a', 1000)];
    const sorted = sortByRank(source);
    expect(sorted.map((entry) => entry._id)).toEqual(['a', 'c']);
    expect(source.map((entry) => entry._id)).toEqual(['c', 'a']);
  });
});

describe('insertion en tete et en queue', () => {
  test('liste vide : premier rang = un pas', () => {
    expect(rankFirst([])).toBe(RANK_STEP);
    expect(rankLast([])).toBe(RANK_STEP);
  });

  test('tete et queue s ecartent d un pas', () => {
    const items = [item('a', 1000), item('b', 2000)];
    expect(rankFirst(items)).toBe(0);
    expect(rankLast(items)).toBe(3000);
  });

  test('les bornes sont prises sur la liste TRIEE, pas sur son ordre d arrivee', () => {
    const items = [item('b', 2000), item('a', 1000)];
    expect(rankFirst(items)).toBe(0);
    expect(rankLast(items)).toBe(3000);
  });
});

describe('placeAt', () => {
  const siblings = [item('a', 1000), item('b', 2000), item('c', 3000)];

  test('colonne vide', () => {
    expect(placeAt([], 0)).toEqual({ rank: RANK_STEP, needsRenumber: false });
  });

  test('en tete : ancre « avant le premier »', () => {
    expect(placeAt(siblings, 0)).toEqual({ rank: 0, needsRenumber: false, beforeId: 'a' });
  });

  test('au milieu : moyenne des deux voisins + les deux ancres', () => {
    expect(placeAt(siblings, 1)).toEqual({
      rank: 1500,
      needsRenumber: false,
      beforeId: 'b',
      afterId: 'a',
    });
  });

  test('en queue : ancre « apres le dernier »', () => {
    expect(placeAt(siblings, 3)).toEqual({ rank: 4000, needsRenumber: false, afterId: 'c' });
  });

  test('index hors bornes ramene aux extremites au lieu de produire NaN', () => {
    expect(placeAt(siblings, -5).rank).toBe(0);
    expect(placeAt(siblings, 99).rank).toBe(4000);
  });
});

describe('placeRelativeTo', () => {
  const siblings = [item('a', 1000), item('b', 2000)];

  test('avant / apres une ancre connue', () => {
    expect(placeRelativeTo(siblings, 'b', 'before').rank).toBe(1500);
    expect(placeRelativeTo(siblings, 'a', 'after').rank).toBe(1500);
  });

  test('ancre inconnue : depot en queue plutot qu un rang NaN', () => {
    // Cas reel : l'element d'ancrage vient d'etre deplace par un autre
    // utilisateur entre l'affichage et le depot.
    expect(placeRelativeTo(siblings, 'disparu', 'before').rank).toBe(3000);
  });
});

describe('epuisement de la precision', () => {
  test('un ecart sous epsilon demande une renumerotation', () => {
    expect(needsRenumber(1000, 1000.00001)).toBe(true);
    expect(needsRenumber(1000, 2000)).toBe(false);
  });

  test('la moyenne qui « colle » a une borne est detectee', () => {
    // Piege du double : bien avant que l'ecart n'atteigne zero, (a+b)/2 finit
    // par valoir exactement a. Tronquer la sans rien dire produirait deux
    // elements de meme rang, donc un ordre instable.
    const low = 1;
    const high = 1 + Number.EPSILON;
    expect(rankBetween(low, high)).toBe(low);
    expect(needsRenumber(low, high)).toBe(true);
  });

  test('insertions repetees au meme endroit : la renumerotation finit par etre demandee', () => {
    let low = 1000;
    const high = 2000;
    let insertions = 0;

    while (!needsRenumber(low, high) && insertions < 200) {
      const middle = rankBetween(low, high);
      expect(middle).toBeGreaterThan(low);
      expect(middle).toBeLessThan(high);
      low = middle;
      insertions += 1;
    }

    expect(needsRenumber(low, high)).toBe(true);
    // ~24 divisions suffisent pour passer sous 0.0001 : la renumerotation est
    // un evenement rare, pas un cout permanent.
    expect(insertions).toBeLessThan(200);
  });

  test('un rang non fini est traite comme une corruption a renumeroter', () => {
    expect(needsRenumber(Number.NaN, 1000)).toBe(true);
    expect(needsRenumber(0, Number.POSITIVE_INFINITY)).toBe(true);
  });
});
