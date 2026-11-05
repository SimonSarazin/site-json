/**
 * Jalons d'un projet Communecter (`src/lib/milestones.ts`, §11.6).
 *
 * Le piege garde ici : un jalon CLOS ne se propose plus, mais une carte qui y
 * est rattachee doit le montrer encore — sinon ouvrir puis enregistrer sa
 * modale la detacherait en silence.
 */
import { describe, expect, test } from 'vitest';
import {
  applyMilestoneChanges,
  countCardsByMilestone,
  EMPTY_MILESTONE_DRAFT,
  hasMilestoneErrors,
  milestoneChoices,
  milestoneCopy,
  milestoneCreatePayload,
  firstInvalidMilestoneField,
  resolveCardMilestone,
  splitMilestones,
  MILESTONE_DESCRIPTION_MAX,
  MILESTONE_FIELD_MAX,
  validateMilestoneDraft,
  validateMilestoneName,
  MILESTONE_NAME_MAX,
} from '@/modules/kanban/lib/milestones';
import { DAY, MILESTONES, NOW } from '../__fixtures__/snapshot';

const [CLOSED, OPEN] = MILESTONES;

describe('listes', () => {
  test('separe ouverts et clos dans l ordre du projet', () => {
    expect(splitMilestones(MILESTONES)).toEqual({ open: [OPEN], closed: [CLOSED] });
  });

  test('le selecteur propose les ouverts, plus le jalon actuel meme clos', () => {
    expect(milestoneChoices(MILESTONES, null)).toEqual([OPEN]);
    expect(milestoneChoices(MILESTONES, CLOSED.milestoneId)).toEqual([CLOSED, OPEN]);
  });

  test('compte les cartes par jalon', () => {
    const counts = countCardsByMilestone([
      { milestone: { milestoneId: OPEN.milestoneId, name: 'V1.2', status: 'open' } },
      { milestone: { milestoneId: OPEN.milestoneId, name: 'V1.2', status: 'open' } },
      { milestone: null },
      {},
    ]);
    expect(counts.get(OPEN.milestoneId)).toBe(2);
    expect(counts.has(CLOSED.milestoneId)).toBe(false);
  });
});

describe('copie portee par la carte', () => {
  test('undefined = non touche, null = detacher, inconnu = non touche', () => {
    expect(milestoneCopy(MILESTONES, undefined)).toBeUndefined();
    expect(milestoneCopy(MILESTONES, null)).toBeNull();
    expect(milestoneCopy(MILESTONES, 'inconnu')).toBeUndefined();
    expect(milestoneCopy(MILESTONES, OPEN.milestoneId)).toEqual({
      milestoneId: OPEN.milestoneId,
      name: 'V1.2',
      status: 'open',
    });
  });

  test('le nom et le statut frais de la liste priment sur la copie', () => {
    const card = { milestone: { milestoneId: OPEN.milestoneId, name: 'Ancien nom', status: 'open' as const } };
    expect(resolveCardMilestone(card, MILESTONES)).toEqual({ milestoneId: OPEN.milestoneId, name: 'V1.2', status: 'open' });
    // Jalon disparu de la liste : la copie sert de repli.
    expect(resolveCardMilestone(card, [])).toEqual(card.milestone);
    expect(resolveCardMilestone({ milestone: null }, MILESTONES)).toBeNull();
  });
});

describe('formulaire', () => {
  test('nom : une regle pour la creation et le renommage (#92)', () => {
    expect(validateMilestoneName('   ')).toBe('required');
    expect(validateMilestoneName('x'.repeat(MILESTONE_NAME_MAX + 1))).toBe('tooLong');
    expect(validateMilestoneName(` ${'x'.repeat(MILESTONE_NAME_MAX)} `)).toBeUndefined();
    expect(validateMilestoneDraft({ ...EMPTY_MILESTONE_DRAFT, name: '   ' }).name).toBe(validateMilestoneName('   '));
  });

  test('le message « trop long » cite la borne DU champ : 200 pour le nom, 5000 pour la description', () => {
    expect(MILESTONE_FIELD_MAX.name).toBe(MILESTONE_NAME_MAX);
    expect(MILESTONE_FIELD_MAX.description).toBe(MILESTONE_DESCRIPTION_MAX);
  });

  test('exige un nom, borne sa longueur', () => {
    expect(validateMilestoneDraft(EMPTY_MILESTONE_DRAFT).name).toBe('required');
    expect(validateMilestoneDraft({ ...EMPTY_MILESTONE_DRAFT, name: 'x'.repeat(MILESTONE_NAME_MAX + 1) }).name).toBe(
      'tooLong',
    );
  });

  test('refuse une date impossible et une fin avant le debut', () => {
    expect(validateMilestoneDraft({ ...EMPTY_MILESTONE_DRAFT, name: 'V2', startDate: '2026-02-31' }).startDate).toBe(
      'invalidDate',
    );
    const errors = validateMilestoneDraft({ ...EMPTY_MILESTONE_DRAFT, name: 'V2', startDate: '2026-10-10', endDate: '2026-10-01' });
    expect(errors.endDate).toBe('dateRange');
    expect(hasMilestoneErrors(errors)).toBe(true);
    expect(hasMilestoneErrors({})).toBe(false);
  });

  test('le corps de creation n envoie pas les champs vides', () => {
    expect(milestoneCreatePayload({ ...EMPTY_MILESTONE_DRAFT, name: '  V2  ' })).toEqual({ name: 'V2' });
    expect(milestoneCreatePayload({ name: 'V2', description: ' Hors ligne ', startDate: '2026-10-01', endDate: '' })).toEqual({
      name: 'V2',
      description: 'Hors ligne',
      startDate: 1790812800,
    });
  });

  test('le focus va au premier champ fautif, dans l ordre de l ecran', () => {
    expect(firstInvalidMilestoneField({ endDate: 'dateRange', name: 'required' })).toBe('name');
    expect(firstInvalidMilestoneField({ description: 'tooLong', endDate: 'dateRange' })).toBe('endDate');
    expect(firstInvalidMilestoneField({})).toBeNull();
  });

  test('fuseau utc : une fin le jour du debut part en fin de journee, apres le debut', () => {
    const payload = milestoneCreatePayload({ name: 'V2', description: '', startDate: '2026-10-01', endDate: '2026-10-01' });
    expect(payload).toEqual({ name: 'V2', startDate: 1790812800, endDate: 1790812800 + DAY - 1 });
    expect(validateMilestoneDraft({ name: 'V2', description: '', startDate: '2026-10-01', endDate: '2026-10-01' })).toEqual({});
  });

  test('applyMilestoneChanges : undefined non touche, null efface une date', () => {
    expect(applyMilestoneChanges(OPEN, { status: 'close' })).toEqual({ ...OPEN, status: 'close' });
    expect(applyMilestoneChanges(OPEN, { endDate: null, name: undefined })).toEqual({ ...OPEN, endDate: null });
    expect(OPEN.endDate).toBe(NOW + 20 * DAY);
  });
});
