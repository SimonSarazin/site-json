/**
 * Region vivante du tableau (constats #38, #64, #104) : deux annonces
 * identiques de suite doivent etre relues.
 */
import { describe, expect, test } from 'vitest';
import { nextAnnouncement } from '@/modules/kanban/components/board/liveRegion';

describe('nextAnnouncement', () => {
  test('un nouveau message passe tel quel', () => {
    expect(nextAnnouncement('', 'Colonne « À faire » masquée.')).toBe('Colonne « À faire » masquée.');
  });

  test('le meme message gagne une espace insecable, puis la perd : le texte change a chaque fois', () => {
    const first = nextAnnouncement('', 'Trois cartes.');
    const second = nextAnnouncement(first, 'Trois cartes.');
    const third = nextAnnouncement(second, 'Trois cartes.');
    expect(second).not.toBe(first);
    expect(second.trim()).toBe('Trois cartes.');
    expect(third).toBe(first);
  });

  test('un message vide efface la region', () => {
    expect(nextAnnouncement('Trois cartes.', '')).toBe('');
  });
});
