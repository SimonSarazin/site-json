/**
 * Fil d'activité (`lib/activityFeed.ts`), repris de co-kanban sans ce qui servait la cloche
 * (marqueur « vu », sélection des nouveautés).
 */
import { describe, expect, test } from 'vitest';
import en from '@/modules/kanban/i18n/en.json';
import fr from '@/modules/kanban/i18n/fr.json';
import { hasTranslation, translationAt } from '@/modules/kanban/__fixtures__/i18nLookup';
import { makeMember } from '@/modules/kanban/__fixtures__/snapshot';
import { ACTIVITY_VERBS, type Activity, type ActivityVerb } from '@/modules/kanban/types';
import { activityActorName, activityLabelKey, activityVerbKey, sortActivitiesDesc } from './activityFeed';

const NOW = 1_800_000_000;

function makeActivity(id: string, at: number, actorId: string, verb: ActivityVerb = 'card.updated'): Activity {
  return { _id: id, boardId: 'board1', cardId: null, columnId: null, actorId, verb, payload: {}, rev: at, at };
}

describe('sortActivitiesDesc', () => {
  test('rend les plus récentes d’abord sans muter l’entrée', () => {
    const journal = [makeActivity('a1', NOW - 300, 'u2'), makeActivity('a2', NOW - 200, 'u1'), makeActivity('a3', NOW - 100, 'u2')];
    expect(sortActivitiesDesc(journal).map((entry) => entry._id)).toEqual(['a3', 'a2', 'a1']);
    expect(journal.map((entry) => entry._id)).toEqual(['a1', 'a2', 'a3']);
  });
});

describe('libellés', () => {
  test('TOUS les verbes du contrat sont traduits, fr et en', () => {
    // La clé est construite à partir du verbe : i18next afficherait sinon la clé en clair.
    const missing = ACTIVITY_VERBS.filter((verb) => typeof translationAt(fr, activityVerbKey(verb)) !== 'string' || typeof translationAt(en, activityVerbKey(verb)) !== 'string');
    expect(missing).toEqual([]);
  });

  test('une carte archivée n’est pas annoncée supprimée', () => {
    expect(activityLabelKey({ ...makeActivity('d', NOW, 'u1', 'card.deleted'), payload: { archived: true } })).toBe('activity.verbs.card.archived');
    expect(activityLabelKey(makeActivity('d', NOW, 'u1', 'card.deleted'))).toBe('activity.verbs.card.deleted');
  });

  test('un changement fait dans Communecter, un jalon modifié : pas « tableau modifié »', () => {
    expect(activityLabelKey({ ...makeActivity('e', NOW, 'communecter', 'board.updated'), payload: { reason: 'externalChange' } })).toBe('activity.verbs.board.externalChange');
    expect(activityLabelKey({ ...makeActivity('m', NOW, 'u1', 'board.updated'), payload: { fields: ['milestones'] } })).toBe('activity.verbs.board.milestones');
    expect(activityLabelKey({ ...makeActivity('s', NOW, 'u1', 'board.updated'), payload: { fields: ['title'] } })).toBe('activity.verbs.board.updated');
  });

  test('role.updated : créé, supprimé, attribué se distinguent ; une forme inconnue garde le générique', () => {
    const base = makeActivity('r', NOW, 'u1', 'role.updated');
    expect(activityLabelKey({ ...base, payload: { role: 'Accueil', created: true } })).toBe('activity.verbs.role.created');
    expect(activityLabelKey({ ...base, payload: { role: 'Accueil', deleted: true, removedFrom: 2 } })).toBe('activity.verbs.role.deleted');
    expect(activityLabelKey({ ...base, payload: { member: { id: 'u2', type: 'citoyens', roles: ['Accueil'] } } })).toBe('activity.verbs.role.assigned');
    expect(activityLabelKey({ ...base, payload: { role: 'Accueil', created: false } })).toBe('activity.verbs.role.updated');
  });

  test('les libellés propres aux tableaux reliés sont traduits, fr et en', () => {
    for (const key of ['activity.verbs.board.externalChange', 'activity.verbs.board.milestones', 'activity.verbs.card.archived', 'activity.communecterActor']) {
      expect(hasTranslation(fr, key) && hasTranslation(en, key), key).toBe(true);
    }
  });
});

describe('activityActorName', () => {
  const members = [makeMember('u1', 'owner', 'Alice'), { ...makeMember('u2', 'editor', ''), profile: { _id: 'u2', name: '', username: 'bob', slug: 'bob', profilThumbImageUrl: null } }];
  const labels = { communecter: 'Communecter', unknown: 'Quelqu’un' };

  test('« communecter » signe les changements faits hors du kanban : jamais « Quelqu’un »', () => {
    expect(activityActorName('communecter', members, labels)).toBe('Communecter');
  });

  test('un membre par son nom, puis son identifiant public ; un inconnu par le libellé de repli', () => {
    expect(activityActorName('u1', members, labels)).toBe('Alice');
    expect(activityActorName('u2', members, labels)).toBe('bob');
    expect(activityActorName('u9', members, labels)).toBe('Quelqu’un');
  });
});
