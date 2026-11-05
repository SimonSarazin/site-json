import { describe, expect, test } from 'vitest';
import { phpLowercase } from '@/modules/kanban/lib/phpLowercase';

/*
 * Valeurs relevees avec `php -r 'echo mb_strtolower($t, "UTF-8");'` sous
 * PHP 7.4.33 (octets compares) : la parite est l'objet meme de ce helper.
 */
describe('phpLowercase', () => {
  test('ASCII et accents : comme toLowerCase', () => {
    expect(phpLowercase('Écran Web')).toBe('écran web');
  });

  test('sigma majuscule : toujours « σ », jamais le sigma final « ς »', () => {
    expect(phpLowercase('ΚΟΣΜΟΣ')).toBe('κοσμοσ');
    expect(phpLowercase('ΛΟΓΟΣ')).toBe('λογοσ');
    expect(phpLowercase('ΟΔΟΣ x')).toBe('οδοσ x');
  });

  test('un sigma final deja saisi en minuscule est conserve', () => {
    expect(phpLowercase('κοσμος')).toBe('κοσμος');
  });
});
