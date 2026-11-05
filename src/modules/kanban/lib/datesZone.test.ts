import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  civilDayIndex,
  daysUntil,
  dueStatus,
  formatDate,
  formatDayMonth,
  fromDateInputValue,
  isOverdue,
  reconcileDateInput,
  sameCivilYear,
  toDateInputValue,
} from '@/modules/kanban/lib/dates';

/*
 * Jour civil SELON LA ZONE (`lib/dates`, constats #53 et #6), rejoue sous trois
 * fuseaux. Kanban gestion lit et ecrit les dates d'action dans le fuseau du
 * navigateur : un board-lien (`local`) doit afficher le meme jour que lui, la
 * ou un board kanban (`utc`) garde le jour UTC quel que soit le lecteur.
 *
 * Cas reel de la base : l'action « Préparation "tapas" pour la buvette »,
 * echeance 2020-12-29T20:00:00Z, soit le 30/12/2020 a 00:00 saisi a La Reunion.
 * Node relit `process.env.TZ` a chaque changement : chaque bloc pose le sien.
 */
const TAPAS_DUE = Date.UTC(2020, 11, 29, 20, 0, 0) / 1000;
const NEXT_MORNING_UTC = Date.UTC(2020, 11, 30, 6, 0, 0) / 1000;

interface ZoneCase {
  zone: string;
  /** Jour civil LOCAL de l'echeance des tapas. */
  localDay: string;
  /** Libelle court francais de ce jour. */
  localLabel: string;
  /** Etat de l'echeance le 30/12 a 06:00 UTC, lu en local. */
  statusNextMorning: 'today' | 'overdue';
}

const ZONES: ZoneCase[] = [
  { zone: 'UTC', localDay: '2020-12-29', localLabel: '29 déc. 2020', statusNextMorning: 'overdue' },
  { zone: 'Indian/Reunion', localDay: '2020-12-30', localLabel: '30 déc. 2020', statusNextMorning: 'today' },
  { zone: 'America/New_York', localDay: '2020-12-29', localLabel: '29 déc. 2020', statusNextMorning: 'overdue' },
];

describe.each(ZONES)('fuseau $zone', ({ zone, localDay, localLabel, statusNextMorning }) => {
  const previousZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = previousZone;
  });

  test('board-lien : affichage et champ de saisie au jour LOCAL, comme gestion', () => {
    expect(toDateInputValue(TAPAS_DUE, 'local')).toBe(localDay);
    expect(formatDate(TAPAS_DUE, 'fr', 'local')).toBe(localLabel);
  });

  test('forme courte « jour mois » et annee commune : lues dans la zone, sur le cache unique (#88)', () => {
    expect(formatDayMonth(TAPAS_DUE, 'fr', 'local')).toBe(localLabel.replace(/ 2020$/, ''));
    expect(formatDayMonth(TAPAS_DUE, 'fr')).toBe('29 déc.');
    // 31/12/2025 22:00 UTC : deja le 1er janvier a La Reunion, encore 2025 ailleurs.
    const newYearsEve = Date.UTC(2025, 11, 31, 22) / 1000;
    const january = Date.UTC(2026, 0, 20, 12) / 1000;
    expect(sameCivilYear(newYearsEve, january)).toBe(false);
    expect(sameCivilYear(newYearsEve, january, 'local')).toBe(zone === 'Indian/Reunion');
  });

  test('board kanban : le jour UTC, quel que soit le fuseau du lecteur', () => {
    expect(toDateInputValue(TAPAS_DUE)).toBe('2020-12-29');
    expect(formatDate(TAPAS_DUE, 'fr')).toBe('29 déc. 2020');
  });

  test('retard et « aujourd hui » se comptent en jours LOCAUX', () => {
    expect(dueStatus(TAPAS_DUE, null, NEXT_MORNING_UTC, 'local')).toBe(statusNextMorning);
    expect(isOverdue(TAPAS_DUE, null, NEXT_MORNING_UTC, 'local')).toBe(statusNextMorning === 'overdue');
  });

  test('saisie : debut en DEBUT de jour, echeance en FIN de jour, aller-retour exact', () => {
    const start = fromDateInputValue('2026-10-23', 'local', 'start');
    const end = fromDateInputValue('2026-10-23', 'local', 'end');
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    if (start === null || end === null) return;
    // Le meme jour civil local, aux deux bornes.
    expect(toDateInputValue(start, 'local')).toBe('2026-10-23');
    expect(toDateInputValue(end, 'local')).toBe('2026-10-23');
    expect(end - start).toBe(86_399);
    expect(civilDayIndex(start, 'local')).toBe(civilDayIndex(end, 'local'));
    // Une date impossible reste refusee dans toutes les zones.
    expect(fromDateInputValue('2026-02-31', 'local')).toBeNull();
  });

  test('echeance le jour d un debut horodate : jamais avant lui, a l instant comme au jour', () => {
    // `card/create` en « En cours » pose « maintenant » : 14:23 UTC.
    const startedAt = Date.UTC(2026, 9, 23, 14, 23) / 1000;
    const due = fromDateInputValue(toDateInputValue(startedAt, 'local'), 'local', 'end');
    expect(due).not.toBeNull();
    if (due === null) return;
    expect(due).toBeGreaterThanOrEqual(startedAt);
    expect(daysUntil(due, startedAt, 'local')).toBe(0);
  });

  test('re-saisir le jour affiche garde l heure posee dans gestion', () => {
    expect(reconcileDateInput(localDay, TAPAS_DUE, 'local', 'end')).toBe(TAPAS_DUE);
    const other = reconcileDateInput('2021-01-05', TAPAS_DUE, 'local', 'end');
    expect(other === null ? '' : toDateInputValue(other, 'local')).toBe('2021-01-05');
    expect(reconcileDateInput('', TAPAS_DUE, 'local', 'end')).toBeNull();
  });
});
