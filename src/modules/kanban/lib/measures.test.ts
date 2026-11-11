/** Montant et temps passe d'une action (`src/lib/measures.ts`, §11.4). */
import { describe, expect, test } from 'vitest';
import {
  CREDITS_MAX,
  formatAmount,
  formatDuration,
  isValidAmount,
  isValidMinutes,
  parseNumberInput,
  TIME_SPENT_MAX,
} from '@/modules/kanban/lib/measures';

describe('formatDuration', () => {
  test('minutes, heures, heures et minutes', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(150)).toBe('2 h 30 min');
    expect(formatDuration(0)).toBe('0 min');
  });

  test('rien a dire pour une valeur absente ou invalide', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(undefined)).toBe('');
    expect(formatDuration(-5)).toBe('');
    expect(formatDuration(Number.NaN)).toBe('');
  });
});

describe('formatAmount', () => {
  test('a la langue de l interface', () => {
    expect(formatAmount(12.5, 'fr')).toBe('12,5');
    expect(formatAmount(12.5, 'en')).toBe('12.5');
    expect(formatAmount(3, 'fr')).toBe('3');
    expect(formatAmount(null, 'fr')).toBe('');
  });
});

describe('saisie', () => {
  test('parseNumberInput : vide -> null, virgule acceptee', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('  ')).toBeNull();
    expect(parseNumberInput('12,5')).toBe(12.5);
    expect(parseNumberInput('40')).toBe(40);
    expect(parseNumberInput('abc')).toBeNull();
  });

  test('montant positif ou nul, minutes entieres', () => {
    expect(isValidAmount(null)).toBe(true);
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidMinutes(90)).toBe(true);
    expect(isValidMinutes(1.5)).toBe(false);
    expect(isValidMinutes(-1)).toBe(false);
    expect(isValidMinutes(null)).toBe(true);
  });

  test('plafonds du serveur : au-dela, c est une faute de frappe', () => {
    expect(isValidAmount(CREDITS_MAX)).toBe(true);
    expect(isValidAmount(CREDITS_MAX + 1)).toBe(false);
    expect(isValidMinutes(TIME_SPENT_MAX)).toBe(true);
    expect(isValidMinutes(TIME_SPENT_MAX + 1)).toBe(false);
  });
});
