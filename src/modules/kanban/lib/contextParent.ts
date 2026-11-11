import type { ParentType } from '@/modules/kanban/types';

/** L'élément porteur du site, vu comme parent d'un tableau relié. */
export interface ContextParent {
  parentType: ParentType;
  parentId: string;
}

/**
 * Parent du tableau à partir du contexte du site (`useCocolight().contextType/contextId`), ou
 * `null` quand le porteur n'a pas de kanban : seuls une organisation et un projet en ont un
 * (le serveur refuserait tout autre type). Pure et testée.
 */
export function contextParent(contextType: string | null | undefined, contextId: string | null | undefined): ContextParent | null {
  if (typeof contextId !== 'string' || contextId === '') return null;
  if (contextType === 'organizations' || contextType === 'projects') return { parentType: contextType, parentId: contextId };
  return null;
}
