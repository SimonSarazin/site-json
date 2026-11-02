import { describe, expect, test } from 'vitest';
import {
  DUE_SOON_DAYS,
  SECONDS_PER_DAY,
  daysUntil,
  dueStatus,
  formatDate,
  formatRelativeDays,
  fromDateInputValue,
  isOverdue,
  nowTimestamp,
  startOfUtcDay,
  toDate,
  toDateInputValue,
  toTimestamp,
} from '@/modules/kanban/lib/dates';

/** 2026-09-17 00:00:00 UTC */
const REFERENCE = Date.UTC(2026, 8, 17) / 1000;

describe('conversions', () => {
  test('secondes <-> Date, aller-retour exact', () => {
    const date = toDate(REFERENCE);
    if (date === null) throw new Error('toDate refuse un horodatage valide');
    expect(toTimestamp(date)).toBe(REFERENCE);
  });

  test('null / undefined / NaN ne produisent pas de Date invalide', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate(Number.NaN)).toBeNull();
  });

  test('nowTimestamp est en SECONDES, pas en millisecondes', () => {
    // Le backend stocke `time()` : une valeur en ms donnerait des echeances en
    // l'an 57000 et casserait tous les comparatifs.
    const now = nowTimestamp();
    expect(now).toBeGreaterThan(1_600_000_000);
    expect(now).toBeLessThan(10_000_000_000);
  });

  test('startOfUtcDay ramene a minuit UTC', () => {
    expect(startOfUtcDay(REFERENCE + 23 * 3600 + 59 * 60)).toBe(REFERENCE);
  });
});

describe('champ <input type="date">', () => {
  test('aller-retour sans decalage d un jour', () => {
    expect(toDateInputValue(fromDateInputValue('2026-09-17'))).toBe('2026-09-17');
  });

  test('valeur vide quand il n y a pas d echeance', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
  });

  test('une date inexistante est refusee au lieu d etre decalee', () => {
    // `Date.UTC(2026, 1, 31)` vaut le 3 mars : accepter cette saisie
    // enregistrerait une echeance que personne n'a choisie.
    expect(fromDateInputValue('2026-02-31')).toBeNull();
    expect(fromDateInputValue('pas une date')).toBeNull();
    expect(fromDateInputValue('')).toBeNull();
  });
});

describe('formatage', () => {
  test('la date affichee suit les jours UTC, pas le fuseau du poste', () => {
    // Parite SSR : le serveur rend en UTC, le navigateur dans son fuseau. Deux
    // instants distants d'une heure de part et d'autre de minuit UTC doivent
    // tomber sur DEUX jours differents ; avec un formatage local, ils
    // tomberaient sur le meme jour civil (offset non nul).
    const beforeMidnight = REFERENCE - 1800;
    const afterMidnight = REFERENCE + 1800;
    expect(formatDate(beforeMidnight, 'fr')).not.toBe(formatDate(afterMidnight, 'fr'));
    expect(formatDate(REFERENCE, 'fr')).toContain('2026');
    expect(formatDate(REFERENCE, 'fr')).toContain('17');
  });

  test('une echeance absente n affiche rien (pas « Invalid Date »)', () => {
    expect(formatDate(null, 'fr')).toBe('');
    expect(formatRelativeDays(null, 'fr')).toBe('');
  });

  test('le relatif est exprime en jours civils', () => {
    const tomorrow = formatRelativeDays(REFERENCE + SECONDS_PER_DAY, 'fr', REFERENCE);
    expect(tomorrow).toBe('demain');
    expect(formatRelativeDays(REFERENCE - SECONDS_PER_DAY, 'en', REFERENCE)).toBe('yesterday');
  });
});

describe('echeances', () => {
  test('daysUntil compte des jours civils, pas des tranches de 24 h', () => {
    // 23 h avant minuit, l'echeance est « aujourd'hui » : arrondir a la
    // journee evite le « dans 0 jour » et le faux retard de derniere heure.
    expect(daysUntil(REFERENCE + 23 * 3600, REFERENCE + 1)).toBe(0);
    expect(daysUntil(REFERENCE + SECONDS_PER_DAY, REFERENCE)).toBe(1);
    expect(daysUntil(REFERENCE - SECONDS_PER_DAY, REFERENCE)).toBe(-1);
  });

  test('une carte close n est jamais en retard (RG-25)', () => {
    const late = REFERENCE - 5 * SECONDS_PER_DAY;
    expect(isOverdue(late, null, REFERENCE)).toBe(true);
    expect(isOverdue(late, REFERENCE - SECONDS_PER_DAY, REFERENCE)).toBe(false);
  });

  test('sans echeance, pas de retard', () => {
    expect(isOverdue(null, null, REFERENCE)).toBe(false);
    expect(dueStatus(null, null, REFERENCE)).toBe('none');
  });

  test('etats d echeance', () => {
    expect(dueStatus(REFERENCE - SECONDS_PER_DAY, null, REFERENCE)).toBe('overdue');
    expect(dueStatus(REFERENCE + 3600, null, REFERENCE)).toBe('today');
    expect(dueStatus(REFERENCE + DUE_SOON_DAYS * SECONDS_PER_DAY, null, REFERENCE)).toBe('soon');
    expect(dueStatus(REFERENCE + (DUE_SOON_DAYS + 1) * SECONDS_PER_DAY, null, REFERENCE)).toBe('later');
    expect(dueStatus(REFERENCE - SECONDS_PER_DAY, REFERENCE, REFERENCE)).toBe('done');
  });
});
