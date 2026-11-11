import { describe, expect, test } from 'vitest';
import { auroraTint, isHexColor, isStrictHexColor, safeHexColor } from '@/modules/kanban/lib/colors';

describe('couleurs venues de la donnee', () => {
  test('isHexColor : les trois formes CSS, rien d autre', () => {
    expect(isHexColor('#abc')).toBe(true);
    expect(isHexColor('#B03E17')).toBe(true);
    expect(isHexColor('#B03E17CC')).toBe(true);
    expect(isHexColor('#abcd')).toBe(false);
    expect(isHexColor(' #abc')).toBe(false);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });

  test('isStrictHexColor : #rrggbb seulement, la forme du module PHP', () => {
    expect(isStrictHexColor('#B03E17')).toBe(true);
    expect(isStrictHexColor('#abc')).toBe(false);
    expect(isStrictHexColor('#B03E17CC')).toBe(false);
  });

  test('aurore : seule une hexadecimale stricte teinte la lueur (la coque ne lit plus la page « Mes projets »)', () => {
    expect(auroraTint('#8C00AA')).toBe('#8c00aa');
    expect(auroraTint(null)).toBeNull();
    expect(auroraTint('#fff')).toBeNull();
    expect(auroraTint('red; background:url(x)')).toBeNull();
  });

  test('safeHexColor retombe sur le jeton pour toute valeur hors hexadecimal', () => {
    expect(safeHexColor('#B03E17', 'var(--ck-fg-muted)')).toBe('#B03E17');
    expect(safeHexColor('url(javascript:alert(1))', 'var(--ck-fg-muted)')).toBe('var(--ck-fg-muted)');
    expect(safeHexColor(undefined, 'var(--ck-fg-muted)')).toBe('var(--ck-fg-muted)');
  });
});
