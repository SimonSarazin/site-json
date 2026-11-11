/**
 * Surface publique du module kanban : le kanban de co-kanban, branché sur l'élément (organisation
 * ou projet) qui porte le site. Les pages se montent par `routes.tsx` ; rien d'autre n'est
 * aujourd'hui consommé hors du module.
 */

// Effet de bord : enregistre le namespace i18n dès qu'on importe quoi que ce soit du module.
import "./i18n";

export { KANBAN_QUERY_KEYS } from "./constants/queryKeys";
export type { KanbanBoardKey, KanbanCardCommentsKey, KanbanCardKey, KanbanMilestonesKey, KanbanRolesKey } from "./constants/queryKeys";
export { KANBAN_BOARD_TYPES, visibleBoardTypes, type KanbanBoardType } from "./components/home/boardTypes";
export { KanbanConfigSchema, KANBAN_BOARD_TYPE_IDS, type KanbanConfig, type KanbanBoardTypeId } from "./schema";
