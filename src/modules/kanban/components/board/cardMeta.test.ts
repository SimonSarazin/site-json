/**
 * Ligne meta d'une carte et total de colonne (DESIGN §6.4) : echeance courte,
 * total des montants, assigne mis en avant, non-lus, montant et temps affiches.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  assigneeSummary,
  creditsTotal,
  displayedCredits,
  displayedTimeSpent,
  isCardOverdueAt,
  shortDueLabel,
  unseenComments,
  type MetaMember,
} from '@/modules/kanban/components/board/cardMeta';

const OCT_22_2026 = Date.UTC(2026, 9, 22) / 1000;
const NOW_2026 = Date.UTC(2026, 9, 1) / 1000;
const NOW_2027 = Date.UTC(2027, 1, 1) / 1000;

describe('shortDueLabel', () => {
  test('annee en cours : jour et mois seulement, comme la maquette', () => {
    expect(shortDueLabel(OCT_22_2026, 'fr', NOW_2026)).toBe('22 oct.');
    expect(shortDueLabel(OCT_22_2026, 'en', NOW_2026)).toBe('Oct 22');
  });

  test('une autre annee garde son annee', () => {
    expect(shortDueLabel(OCT_22_2026, 'fr', NOW_2027)).toBe('22 oct. 2026');
  });

  test('horloge inconnue (rendu serveur) : forme longue, stable a l hydratation', () => {
    expect(shortDueLabel(OCT_22_2026, 'fr', 0)).toBe('22 oct. 2026');
  });
});

describe('creditsTotal', () => {
  test('somme des montants presents, arrondie au centime', () => {
    expect(creditsTotal([{ credits: 0.1 }, { credits: 0.2 }, { credits: 3 }])).toBe(3.3);
  });

  test('les montants absents ou illisibles sont ignores', () => {
    expect(creditsTotal([{ credits: 2 }, { credits: null }, {}, { credits: Number.NaN }])).toBe(2);
  });

  /*
   * Constat #63 : chaque carte compte pour le montant qu'elle AFFICHE. Le `1`
   * par defaut du serveur vaut 0, comme dans les totaux de Kanban gestion
   * (`creditDisplayVal`) : quatre cartes sans montant saisi totalisaient « 4 ».
   */
  test('le montant par defaut (1) ne compte pas, comme dans gestion', () => {
    expect(creditsTotal([{ credits: 1 }, { credits: 1 }, { credits: 1 }, { credits: 1 }])).toBe(0);
    expect(creditsTotal([{ credits: 100 }, { credits: 1 }, { credits: 1 }, { credits: 1 }])).toBe(100);
  });

  test('toujours un nombre : une colonne sans montant totalise 0, comme dans gestion', () => {
    expect(creditsTotal([{}, { credits: null }])).toBe(0);
    expect(creditsTotal([])).toBe(0);
    expect(creditsTotal([{ credits: 0 }])).toBe(0);
  });
});

describe('isCardOverdueAt', () => {
  const DUE = Date.UTC(2026, 9, 22) / 1000;
  const card = { dueDate: DUE, completedAt: null, status: 'not_started' as const };

  test('au jour civil : pas en retard le jour de l echeance, en retard le lendemain', () => {
    expect(isCardOverdueAt(card, Date.UTC(2026, 9, 22, 10) / 1000)).toBe(false);
    expect(isCardOverdueAt(card, Date.UTC(2026, 9, 23, 0, 0, 1) / 1000)).toBe(true);
  });

  test('une carte close ne l est jamais, meme sans date de cloture (E11)', () => {
    const later = Date.UTC(2026, 10, 1) / 1000;
    expect(isCardOverdueAt({ ...card, status: 'complete' }, later)).toBe(false);
    expect(isCardOverdueAt({ ...card, completedAt: DUE }, later)).toBe(false);
  });

  test('horloge inconnue (rendu serveur) ou sans echeance : rien en retard', () => {
    expect(isCardOverdueAt(card, 0)).toBe(false);
    expect(isCardOverdueAt({ ...card, dueDate: null }, Date.UTC(2027, 0, 1) / 1000)).toBe(false);
  });
});

/*
 * Board-lien : les dates d'action sont des instants saisis en heure LOCALE par
 * Kanban gestion (lib/dates, `local`). La carte doit dire le jour que gestion
 * affiche, et juger le retard sur ce jour-la (#9, #53).
 */
describe('carte d un board-lien : jour civil du navigateur', () => {
  const previousZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Indian/Reunion';
  });
  afterAll(() => {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  });

  // 21/10 20:00 UTC = 22/10 00:00 a La Reunion : l'echeance est « le 22 ».
  const DUE_LOCAL = Date.UTC(2026, 9, 21, 20) / 1000;
  const action = { dueDate: DUE_LOCAL, completedAt: null, status: 'not_started' as const };

  test('echeance courte au jour local', () => {
    expect(shortDueLabel(DUE_LOCAL, 'fr', NOW_2026, 'local')).toBe('22 oct.');
    expect(shortDueLabel(DUE_LOCAL, 'fr', NOW_2026)).toBe('21 oct.');
  });

  test('pas en retard le 22 au matin heure locale, alors que le jour UTC de l echeance est passe', () => {
    const morningOf22 = Date.UTC(2026, 9, 22, 5) / 1000; // 09:00 a La Reunion
    expect(isCardOverdueAt(action, morningOf22, 'local')).toBe(false);
    expect(isCardOverdueAt(action, morningOf22)).toBe(true);
  });
});

describe('assigneeSummary', () => {
  const index = new Map<string, MetaMember>([
    ['u1', { userId: 'u1', name: 'Elie Fidèle', avatarUrl: null }],
    ['u2', { userId: 'u2', name: 'Jerry Lee', avatarUrl: '/upload/x.png' }],
  ]);

  test('le premier assigne connu est mis en avant, les autres sont comptes', () => {
    expect(assigneeSummary(['u2', 'u1'], index)).toEqual({ lead: index.get('u2'), others: 1 });
  });

  test('un assigne inconnu (compte retire) est ignore', () => {
    expect(assigneeSummary(['ghost', 'u1'], index)).toEqual({ lead: index.get('u1'), others: 0 });
  });

  test('personne de connu : null', () => {
    expect(assigneeSummary([], index)).toBeNull();
    expect(assigneeSummary(['ghost'], index)).toBeNull();
  });
});

describe('compteurs affiches', () => {
  test('non-lus : absent ou negatif = 0, entier sinon', () => {
    expect(unseenComments({})).toBe(0);
    expect(unseenComments({ unseenComments: -3 })).toBe(0);
    expect(unseenComments({ unseenComments: 2 })).toBe(2);
  });

  test('montant : le defaut serveur (1) ne s affiche pas, un montant saisi oui', () => {
    expect(displayedCredits({ credits: 1 })).toBeNull();
    expect(displayedCredits({ credits: null })).toBeNull();
    expect(displayedCredits({})).toBeNull();
    expect(displayedCredits({ credits: 0 })).toBe(0);
    expect(displayedCredits({ credits: 12.5 })).toBe(12.5);
  });

  test('temps passe : seulement s il y en a', () => {
    expect(displayedTimeSpent({ timeSpent: 0 })).toBeNull();
    expect(displayedTimeSpent({})).toBeNull();
    expect(displayedTimeSpent({ timeSpent: 90 })).toBe(90);
  });
});
