import { describe, expect, test } from 'vitest';
import { fieldDescribedBy, fieldErrorId, fieldHintId } from './fieldIds';

describe('fieldDescribedBy', () => {
  test('l erreur prime sur l aide, qui prime sur rien', () => {
    expect(fieldDescribedBy('titre', { hint: 'Aide', error: 'Erreur' })).toBe(fieldErrorId('titre'));
    expect(fieldDescribedBy('titre', { hint: 'Aide' })).toBe(fieldHintId('titre'));
    expect(fieldDescribedBy('titre', {})).toBeUndefined();
  });

  test('les identifiants dérivent de celui du contrôle', () => {
    expect(fieldHintId('t1')).toBe('t1-hint');
    expect(fieldErrorId('t1')).toBe('t1-error');
  });
});
