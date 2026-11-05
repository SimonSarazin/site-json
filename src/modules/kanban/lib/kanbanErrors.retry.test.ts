import { describe, expect, test } from 'vitest';
import { KanbanApiError, KanbanAuthError, shouldRetryKanbanQuery } from './kanbanErrors';

describe('shouldRetryKanbanQuery', () => {
  test('une seule nouvelle tentative, sur un échec passager', () => {
    for (const code of ['network', 'timeout']) {
      const error = new KanbanApiError(code, { code });
      expect(shouldRetryKanbanQuery(0, error)).toBe(true);
      expect(shouldRetryKanbanQuery(1, error)).toBe(false);
    }
    expect(shouldRetryKanbanQuery(0, new KanbanApiError('x', { status: 500, code: 'serverError' }))).toBe(true);
  });

  test('un refus ou une session expirée ne se réessaie pas', () => {
    expect(shouldRetryKanbanQuery(0, new KanbanApiError('notMember', { status: 403, code: 'notMember' }))).toBe(false);
    expect(shouldRetryKanbanQuery(0, new KanbanApiError('notFound', { status: 404, code: 'notFound' }))).toBe(false);
    expect(shouldRetryKanbanQuery(0, new KanbanAuthError('expiree'))).toBe(false);
    expect(shouldRetryKanbanQuery(0, new TypeError('bug local'))).toBe(false);
  });
});
