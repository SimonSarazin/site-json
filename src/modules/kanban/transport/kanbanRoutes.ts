/**
 * Les 20 routes kanban d'un tableau relié à un élément : CONSTANTE du registre du SDK → chemin.
 *
 * Depuis le SDK 1.0.205, ces routes sont dans le registre de `@communecter/cocolight-api-client`
 * (`KANBAN_*_URL`, sans schéma `request` ni `responses`, cf. `doc/41-module-kanban-sdk.md`). Le
 * module ne les déclare donc plus : il appelle le client principal du site par leur constante.
 *
 * Cette table reste pour deux usages SANS lien avec le transport :
 *  - le type `KanbanEndpoint`, l'union des 20 constantes, que `KanbanClient.post` exige — le SDK
 *    type `callEndpoint(constant: string)` et n'exporte pas d'union utilisable en type ;
 *  - le CHEMIN d'une route, porté par `KanbanApiError.url` pour le diagnostic et lu par le faux SDK
 *    des tests (`__fixtures__/fakeSdk.ts`) pour nommer ses routes (`board/sync`…).
 *
 * Elle est vérifiée contre le registre du SDK par `kanbanRoutes.test.ts` : une constante ou un chemin
 * qui divergerait du SDK installé échoue là, pas en production.
 */

export const KANBAN_ROUTES = {
  KANBAN_BOARD_CREATE_URL: "/costum/kanban-board/create",
  KANBAN_BOARD_GET_URL: "/costum/kanban-board/get",
  KANBAN_BOARD_SYNC_URL: "/costum/kanban-board/sync",
  KANBAN_COLUMN_MOVE_URL: "/costum/kanban-column/move",
  KANBAN_CARD_CREATE_URL: "/costum/kanban-card/create",
  KANBAN_CARD_GET_URL: "/costum/kanban-card/get",
  KANBAN_CARD_UPDATE_URL: "/costum/kanban-card/update",
  KANBAN_CARD_MOVE_URL: "/costum/kanban-card/move",
  KANBAN_CARD_ARCHIVE_URL: "/costum/kanban-card/archive",
  KANBAN_COMMENT_LIST_URL: "/costum/kanban-comment/list",
  KANBAN_COMMENT_ADD_URL: "/costum/kanban-comment/add",
  KANBAN_COMMENT_DELETE_URL: "/costum/kanban-comment/delete",
  KANBAN_MILESTONE_LIST_URL: "/costum/kanban-milestone/list",
  KANBAN_MILESTONE_CREATE_URL: "/costum/kanban-milestone/create",
  KANBAN_MILESTONE_UPDATE_URL: "/costum/kanban-milestone/update",
  KANBAN_ROLE_LIST_URL: "/costum/kanban-role/list",
  KANBAN_ROLE_CREATE_URL: "/costum/kanban-role/create",
  KANBAN_ROLE_ASSIGN_URL: "/costum/kanban-role/assign",
  KANBAN_ROLE_UNASSIGN_URL: "/costum/kanban-role/unassign",
  KANBAN_ROLE_DELETE_URL: "/costum/kanban-role/delete",
} as const;

/** Constante d'une route kanban : le seul identifiant de route que connaît le module. */
export type KanbanEndpoint = keyof typeof KANBAN_ROUTES;

/** Chemin d'une route, pour le diagnostic porté par l'erreur. */
export function kanbanRoutePath(endpoint: KanbanEndpoint): string {
  return KANBAN_ROUTES[endpoint];
}
