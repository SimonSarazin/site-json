/**
 * Ordre canonique d'un board-lien (`src/lib/canonicalOrder.ts`, blueprint D16).
 *
 * Ce que ces tests protegent : le rang est calcule DES DEUX COTES, par le
 * module PHP (`ActionCards::canonicalRank`) et par le front pour l'optimiste.
 * Une divergence d'une decimale ferait sauter une carte a la reponse du
 * serveur. Les valeurs de reference ci-dessous ont ete produites par la
 * classe PHP elle-meme (`ActionCards::canonicalRank`, 23/10/2026, departage
 * sur 16 bits) : elles sont le contrat. La couture est aussi eprouvee sur les
 * VRAIES reponses du module par `tests/contract/php-fixtures.test.ts`.
 */
import { describe, expect, test } from 'vitest';
import {
  applyCanonicalRanks,
  canonicalRank,
  CANONICAL_RANK_SPAN,
  compareCanonical,
  MAX_TIMESTAMP,
} from '@/modules/kanban/lib/canonicalOrder';

const ID = '65cf05be238dc11a2b67c563';

describe('canonicalRank — parite avec le module PHP', () => {
  test('reproduit EXACTEMENT les rangs calcules par la classe PHP', () => {
    // Egalite stricte, pas `toBeCloseTo` : les memes operations IEEE 754 dans le
    // meme ordre donnent le meme double, et c'est ce double qui part sur le fil.
    expect(canonicalRank({ _id: ID, priority: 'urgent', created: 1_800_000_000 })).toBe(2302444800.228966);
    expect(canonicalRank({ _id: ID, priority: null, created: 1_800_000_000 })).toBe(42302444800.228966);
    expect(canonicalRank({ _id: 'tmp-3', priority: 'medium', created: 1_800_000_000 })).toBe(22302444800.5);
    expect(
      canonicalRank({ _id: '000000000000000000000000', priority: 'low', created: 1_700_000_000 }),
    ).toBe(32402444800.999985);
  });

  test('deux compteurs CONSECUTIFS donnent deux rangs distincts (16 bits, pas 24)', () => {
    const first = canonicalRank({ _id: '66aa00010000000000000001', priority: null, created: 100 });
    const second = canonicalRank({ _id: '66aa00010000000000000002', priority: null, created: 100 });
    expect(first).toBe(44102444700.99997);
    expect(second).toBe(44102444700.999954);
    expect(second).toBeLessThan(first);
  });

  test('une tranche de priorite ne passe jamais devant la precedente, quelle que soit la date', () => {
    // La plus ancienne action « haute » reste devant la plus recente « moyenne ».
    const oldHigh = canonicalRank({ _id: ID, priority: 'high', created: 0 });
    const newMedium = canonicalRank({ _id: ID, priority: 'medium', created: MAX_TIMESTAMP });
    expect(oldHigh).toBeLessThan(newMedium);
    expect(CANONICAL_RANK_SPAN).toBeGreaterThan(MAX_TIMESTAMP);
  });

  test('borne les dates hors de 1970..2100 au lieu de deborder sur une autre tranche', () => {
    const tooLate = canonicalRank({ _id: ID, priority: 'urgent', created: MAX_TIMESTAMP * 10 });
    expect(tooLate).toBeLessThan(CANONICAL_RANK_SPAN);
    expect(tooLate).toBeGreaterThanOrEqual(0);
  });
});

describe('compareCanonical — l ordre de Kanban gestion', () => {
  test('priorite (urgent -> aucune), puis la plus recente d abord', () => {
    const cards = [
      { _id: 'a'.repeat(24), rank: 0, priority: null, created: 300 },
      { _id: 'b'.repeat(24), rank: 0, priority: 'low' as const, created: 100 },
      { _id: 'c'.repeat(24), rank: 0, priority: 'urgent' as const, created: 100 },
      { _id: 'd'.repeat(24), rank: 0, priority: 'urgent' as const, created: 200 },
    ];
    expect([...cards].sort(compareCanonical).map((card) => card._id[0])).toEqual(['d', 'c', 'b', 'a']);
  });

  test('meme seconde : le plus grand compteur d ObjectId passe devant', () => {
    const first = { _id: '66aa00010000000000000001', rank: 0, priority: null, created: 100 };
    const second = { _id: '66aa00010000000000000002', rank: 0, priority: null, created: 100 };
    expect([first, second].sort(compareCanonical)[0]).toBe(second);
  });
});

describe('applyCanonicalRanks', () => {
  test('pose le rang canonique sur chaque carte', () => {
    const [card] = applyCanonicalRanks([{ _id: ID, rank: 1000, priority: 'urgent' as const, created: 1_800_000_000 }]);
    expect(card.rank).toBe(2302444800.228966);
  });

  test('conserve l identite d une carte deja a son rang (pas de rendu inutile)', () => {
    const card = { _id: ID, rank: 0, priority: 'high' as const, created: 42 };
    const ranked = { ...card, rank: canonicalRank(card) };
    const [same] = applyCanonicalRanks([ranked]);
    expect(same).toBe(ranked);
  });

  test('le rang ne depend que de la carte : changer de colonne ne le change pas', () => {
    const card = { _id: ID, rank: 0, priority: null, created: 1_800_000_000, columnId: 'todo' };
    const [inTodo] = applyCanonicalRanks([card]);
    const [inDone] = applyCanonicalRanks([{ ...card, columnId: 'done' }]);
    expect(inTodo.rank).toBe(inDone.rank);
  });
});
