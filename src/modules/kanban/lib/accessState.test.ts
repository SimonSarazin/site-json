import { describe, expect, test } from 'vitest';
import { KanbanApiError, KanbanAuthError } from './kanbanErrors';
import { kanbanAccessState } from './accessState';

const parent = { parentType: 'projects' as const, parentId: 'p1' };
const base = { hydrated: true, userId: 'u1', parent, error: null };

describe('kanbanAccessState', () => {
  test('avant hydratation : rien de décidé, quoi qu on sache (parité SSR)', () => {
    expect(kanbanAccessState({ ...base, hydrated: false, userId: null })).toBe('pending');
    expect(kanbanAccessState({ ...base, hydrated: false, parent: null })).toBe('pending');
  });

  test('porteur sans kanban, puis visiteur anonyme', () => {
    expect(kanbanAccessState({ ...base, parent: null })).toBe('unavailable');
    expect(kanbanAccessState({ ...base, userId: null })).toBe('anonymous');
  });

  test('refus du serveur : réservé aux membres ; session expirée : se reconnecter', () => {
    expect(kanbanAccessState({ ...base, error: new KanbanApiError('notMember', { status: 403, code: 'notMember' }) })).toBe('notMember');
    expect(kanbanAccessState({ ...base, error: new KanbanApiError('forbidden', { status: 403, code: 'forbidden' }) })).toBe('notMember');
    expect(kanbanAccessState({ ...base, error: new KanbanAuthError('expiree') })).toBe('anonymous');
  });

  test('autre échec : à réessayer', () => {
    expect(kanbanAccessState({ ...base, error: new KanbanApiError('x', { code: 'network' }) })).toBe('failed');
    expect(kanbanAccessState({ ...base, error: new KanbanApiError('x', { status: 404, code: 'notFound' }) })).toBe('failed');
  });

  test('accès ouvert, ou en cours quand l appelant attend le tableau', () => {
    expect(kanbanAccessState(base)).toBe('open');
    expect(kanbanAccessState({ ...base, loaded: false })).toBe('pending');
    expect(kanbanAccessState({ ...base, loaded: true })).toBe('open');
  });
});
