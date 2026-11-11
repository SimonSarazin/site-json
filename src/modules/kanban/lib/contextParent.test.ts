import { describe, expect, test } from 'vitest';
import { contextParent } from './contextParent';

describe('contextParent', () => {
  test('organisation et projet portent un kanban', () => {
    expect(contextParent('organizations', 'o1')).toEqual({ parentType: 'organizations', parentId: 'o1' });
    expect(contextParent('projects', 'p1')).toEqual({ parentType: 'projects', parentId: 'p1' });
  });

  test('tout autre porteur, ou un contexte non résolu : pas de kanban', () => {
    expect(contextParent('events', 'e1')).toBeNull();
    expect(contextParent('citoyens', 'u1')).toBeNull();
    expect(contextParent('organizations', '')).toBeNull();
    expect(contextParent(undefined, undefined)).toBeNull();
  });
});
