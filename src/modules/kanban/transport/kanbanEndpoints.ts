/**
 * PONT TEMPORAIRE — les 20 routes kanban d'un tableau relié à un élément, au format du registre
 * du SDK (`endpoints-copie.json` de `cocolight-api-client`).
 *
 * POURQUOI ce fichier existe : le SDK ne connaît aucune route kanban, et il est en lecture
 * seule (CLAUDE.md §3). Les 20 routes sont décrites pour le mainteneur dans
 * `doc/41-module-kanban-sdk.md` (`ENDPOINT.md` y renvoie). En attendant, `sdkKanbanClient.ts`
 * les sert par une instance `ApiClient` dédiée, construite avec l'option PUBLIQUE `endpoints` du
 * constructeur. On passe donc par le SDK
 * (jeton, rafraîchissement, erreurs typées), sans `fetch` brut et sans toucher au SDK.
 *
 * À LA LIVRAISON du SDK : supprimer ce fichier et faire appeler par `sdkKanbanClient.ts` le
 * client principal (procédure : doc 41 §2). Les constantes sont celles demandées, le reste du
 * module ne change pas.
 *
 * Volontairement SANS schéma `request` : avec un schéma, `callEndpoint` retire en profondeur
 * tout `null` du payload (`ApiClient.stripNullsInPlace`). Or `null` veut dire « effacer » dans
 * ce contrat (`dueDate`, `priority`, `milestoneId`…) : l'effacement serait perdu en silence.
 * La forme des payloads est tenue par les types de `api/*.ts`, celle des réponses par les
 * gardes de `types.ts`.
 */

/** Une route kanban : POST JSON sous jeton Bearer, toutes sous `/costum/kanban-<contrôleur>/`. */
const route = <C extends string>(constant: C, path: string) =>
  ({ constant, path, method: "POST", contentType: "application/json", auth: "bearer" }) as const;

export const KANBAN_ENDPOINTS = [
  route("KANBAN_BOARD_CREATE_URL", "/costum/kanban-board/create"),
  route("KANBAN_BOARD_GET_URL", "/costum/kanban-board/get"),
  route("KANBAN_BOARD_SYNC_URL", "/costum/kanban-board/sync"),
  route("KANBAN_COLUMN_MOVE_URL", "/costum/kanban-column/move"),
  route("KANBAN_CARD_CREATE_URL", "/costum/kanban-card/create"),
  route("KANBAN_CARD_GET_URL", "/costum/kanban-card/get"),
  route("KANBAN_CARD_UPDATE_URL", "/costum/kanban-card/update"),
  route("KANBAN_CARD_MOVE_URL", "/costum/kanban-card/move"),
  route("KANBAN_CARD_ARCHIVE_URL", "/costum/kanban-card/archive"),
  route("KANBAN_COMMENT_LIST_URL", "/costum/kanban-comment/list"),
  route("KANBAN_COMMENT_ADD_URL", "/costum/kanban-comment/add"),
  route("KANBAN_COMMENT_DELETE_URL", "/costum/kanban-comment/delete"),
  route("KANBAN_MILESTONE_LIST_URL", "/costum/kanban-milestone/list"),
  route("KANBAN_MILESTONE_CREATE_URL", "/costum/kanban-milestone/create"),
  route("KANBAN_MILESTONE_UPDATE_URL", "/costum/kanban-milestone/update"),
  route("KANBAN_ROLE_LIST_URL", "/costum/kanban-role/list"),
  route("KANBAN_ROLE_CREATE_URL", "/costum/kanban-role/create"),
  route("KANBAN_ROLE_ASSIGN_URL", "/costum/kanban-role/assign"),
  route("KANBAN_ROLE_UNASSIGN_URL", "/costum/kanban-role/unassign"),
  route("KANBAN_ROLE_DELETE_URL", "/costum/kanban-role/delete"),
] as const;

/** Constante d'une route kanban : le seul identifiant de route que connaît le module. */
export type KanbanEndpoint = (typeof KANBAN_ENDPOINTS)[number]["constant"];
