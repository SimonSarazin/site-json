import type { KanbanEndpoint } from "./kanbanClient";

/**
 * Chemins des routes kanban, DÉRIVÉS de leur constante de registre : `KANBAN_CARD_MOVE_URL` →
 * `/costum/kanban-card/move`. Les 20 constantes suivent toutes cette forme (contrôleur, action),
 * et `kanbanRoutes.test.ts` le vérifie contre le registre du SDK installé : plus de table à tenir.
 *
 * Deux usages, sans lien avec le transport : le chemin porté par `KanbanApiError.url` pour le
 * diagnostic, et le nom court (`card/move`) sous lequel le faux SDK des tests sert ses routes.
 */

const CONSTANT = /^KANBAN_([A-Z]+)_([A-Z]+)_URL$/;

/** Nom court d'une route : `KANBAN_BOARD_SYNC_URL` → `board/sync`. */
export function kanbanRouteName(endpoint: KanbanEndpoint): string {
  const match = CONSTANT.exec(endpoint);
  return match ? `${match[1].toLowerCase()}/${match[2].toLowerCase()}` : endpoint;
}

/** Chemin HTTP d'une route : `KANBAN_BOARD_SYNC_URL` → `/costum/kanban-board/sync`. */
export function kanbanRoutePath(endpoint: KanbanEndpoint): string {
  return `/costum/kanban-${kanbanRouteName(endpoint)}`;
}
