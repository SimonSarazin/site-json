// @vitest-environment jsdom
/**
 * Point de priorite (constats #36 et #105) : quatre FORMES distinctes, lisibles
 * sans la couleur, et tracees en SVG (`currentColor`) pour survivre au mode
 * couleurs forcees, qui retire fonds et ombres.
 */
import '@/modules/kanban/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { PriorityDot } from '@/modules/kanban/components/board/PriorityDot';
import { PRIORITY_DOT_CLASS, PRIORITY_DOT_SHAPE } from '@/modules/kanban/components/board/priorityTone';
import type { Priority } from '@/modules/kanban/types';

afterEach(cleanup);

const LEVELS: Priority[] = ['low', 'medium', 'high', 'urgent'];

describe('formes du point de priorite', () => {
  test('les quatre niveaux ont quatre silhouettes differentes', () => {
    expect(new Set(Object.values(PRIORITY_DOT_SHAPE)).size).toBe(4);
    // « Haute » et « Urgente » ne se distinguaient que par la teinte.
    expect(PRIORITY_DOT_SHAPE.high).not.toBe(PRIORITY_DOT_SHAPE.urgent);
  });

  test('le dessin ne passe ni par un fond ni par une ombre (couleurs forcees)', () => {
    for (const level of LEVELS) {
      expect(PRIORITY_DOT_CLASS[level]).not.toMatch(/\bbg-|shadow-|ring-/);
    }
  });

  test('chaque niveau rend un SVG en currentColor, nomme pour le lecteur d’ecran, de geometrie distincte', () => {
    const drawings = new Set<string>();
    for (const level of LEVELS) {
      const { container, unmount } = render(<PriorityDot priority={level} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.innerHTML).toContain('currentColor');
      drawings.add(svg?.innerHTML ?? '');
      unmount();
    }
    expect(drawings.size).toBe(4);
  });

  test('nom accessible « Priorité : … », et rien sans priorite', () => {
    render(<PriorityDot priority="urgent" />);
    expect(screen.getByRole('img', { name: 'Priorité : Urgente' })).toBeTruthy();
    cleanup();
    const { container } = render(<PriorityDot priority={null} />);
    expect(container.innerHTML).toBe('');
  });
});
