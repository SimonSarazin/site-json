import { describe, expect, test } from 'vitest';
import { sessionProfile } from './sessionProfile';

describe('sessionProfile', () => {
  test('projette les champs de la session comme le serveur projette un membre', () => {
    expect(sessionProfile('u1', { name: 'Ada', username: 'ada', slug: 'ada-l', profilThumbImageUrl: '/upload/a.jpg' })).toEqual({
      _id: 'u1',
      name: 'Ada',
      username: 'ada',
      slug: 'ada-l',
      profilThumbImageUrl: '/upload/a.jpg',
    });
  });

  test('sans slug ni nom, le pseudo en tient lieu ; sans portrait, null', () => {
    expect(sessionProfile('u1', { username: 'ada' })).toEqual({
      _id: 'u1',
      name: 'ada',
      username: 'ada',
      slug: 'ada',
      profilThumbImageUrl: null,
    });
  });

  test('personne connectée inconnue : pas de profil', () => {
    expect(sessionProfile(null, { username: 'ada' })).toBeNull();
    expect(sessionProfile('u1', null)).toBeNull();
  });
});
