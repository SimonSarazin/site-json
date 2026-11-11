/**
 * Horloge des echeances (constat #52) : elle ne change qu'au changement de
 * jour, sinon chaque minute rendait de nouveau toutes les cartes. Le jour
 * change a minuit UTC (board kanban) ET a minuit local (board-lien, #53).
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { nextDayClock } from '@/modules/kanban/components/board/boardClock';

const at = (day: number, hour: number) => Date.UTC(2026, 9, day, hour) / 1000;

function inZone(zone: string) {
  const previousZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  });
}

describe('nextDayClock (fuseau UTC)', () => {
  inZone('UTC');

  test('horloge inconnue (0, rendu serveur) : remplacee par l instant reel', () => {
    expect(nextDayClock(0, at(22, 10))).toBe(at(22, 10));
  });

  test('meme jour : la MEME valeur est rendue (aucun rendu React)', () => {
    const morning = at(22, 8);
    expect(nextDayClock(morning, at(22, 18))).toBe(morning);
  });

  test('changement de jour : la nouvelle valeur passe', () => {
    expect(nextDayClock(at(22, 23), at(23, 0))).toBe(at(23, 0));
  });
});

describe('nextDayClock (La Reunion, UTC+4)', () => {
  inZone('Indian/Reunion');

  test('minuit LOCAL passe avant minuit UTC : l horloge change, une action due la veille devient en retard', () => {
    // 22/10 10:00 UTC = 14:00 locale ; 22/10 21:00 UTC = 23/10 01:00 locale.
    expect(nextDayClock(at(22, 10), at(22, 21))).toBe(at(22, 21));
  });

  test('meme jour local et UTC : aucune nouvelle valeur', () => {
    expect(nextDayClock(at(22, 1), at(22, 15))).toBe(at(22, 1));
  });
});
