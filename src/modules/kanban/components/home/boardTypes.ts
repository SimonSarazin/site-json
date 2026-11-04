import { SquareKanban, UsersRound, type LucideIcon } from 'lucide-react';
import { KANBAN_BOARD_TYPE_IDS, type KanbanBoardTypeId, type KanbanConfig } from '@/modules/kanban/schema';
import type { ParentType } from '@/modules/kanban/types';

/**
 * Registre des types de kanban proposés sur `/kanban`.
 *
 * L'écran de liste, le routage et la config lisent CE tableau, jamais un `if` par type :
 * ajouter un kanban (par exemple ceux des projets d'une organisation) revient à ajouter une
 * entrée ici, son identifiant dans `KANBAN_BOARD_TYPE_IDS` et sa page.
 */
export interface KanbanBoardType {
  id: KanbanBoardTypeId;
  /** Segment d'URL sous `/kanban`. */
  path: string;
  icon: LucideIcon;
  /** Clés i18n (`modules/kanban`) du titre et de la description de la tuile. */
  titleKey: string;
  descriptionKey: string;
  /** Types d'élément porteur où ce kanban a un sens (les deux, aujourd'hui). */
  parentTypes: readonly ParentType[];
}

export const KANBAN_BOARD_TYPES: readonly KanbanBoardType[] = [
  {
    id: 'actions',
    path: 'actions',
    icon: SquareKanban,
    titleKey: 'home.boards.actions.title',
    descriptionKey: 'home.boards.actions.description',
    parentTypes: ['organizations', 'projects'],
  },
  {
    id: 'roles',
    path: 'roles',
    icon: UsersRound,
    titleKey: 'home.boards.roles.title',
    descriptionKey: 'home.boards.roles.description',
    parentTypes: ['organizations', 'projects'],
  },
];

/** Entrée du registre pour un identifiant ; le test du registre garantit qu'elle existe. */
export function boardTypeOf(id: KanbanBoardTypeId): KanbanBoardType {
  const type = KANBAN_BOARD_TYPES.find((entry) => entry.id === id);
  if (!type) throw new Error(`Kanban absent du registre : ${id}`);
  return type;
}

/**
 * Kanbans à afficher, dans l'ordre de `config.kanban.boards` (tous, sinon), restreints au
 * type de l'élément porteur. Défensive : la config n'est pas revalidée à l'exécution, une
 * valeur inconnue ou répétée est ignorée au lieu de casser l'écran. Pure et testée.
 */
export function visibleBoardTypes(config: KanbanConfig | null | undefined, parentType: ParentType): KanbanBoardType[] {
  const wanted = Array.isArray(config?.boards) ? config.boards : KANBAN_BOARD_TYPE_IDS;
  const seen = new Set<string>();
  const result: KanbanBoardType[] = [];
  for (const id of wanted) {
    const type = KANBAN_BOARD_TYPES.find((entry) => entry.id === id);
    if (!type || seen.has(id) || !type.parentTypes.includes(parentType)) continue;
    seen.add(id);
    result.push(type);
  }
  return result;
}
