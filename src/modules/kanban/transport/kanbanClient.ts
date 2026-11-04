import type { Kanban, KanbanColumnId, KanbanEndpointConstant } from "@communecter/cocolight-api-client";

/**
 * Contrat du transport kanban : la SEULE porte du module vers le backend.
 *
 * Le SDK (≥ 1.0.205) porte les 20 routes d'un tableau relié et les sert par sa façade typée
 * `api.kanban.board/column/card/comment/milestone/role.*`. Le transport ne refait pas cette
 * façade : il l'EXPOSE à `api/*.ts` au travers d'un appel unique (`call`), qui ajoute ce que le
 * SDK ne fait pas — traduction des erreurs en `KanbanApiError`, garde de type sur `data`,
 * annulation — et désigne la route par sa constante de registre pour le diagnostic.
 *
 * Une implémentation : celle du SDK (`sdkKanbanClient.ts`), que les tests branchent sur une
 * façade simulée (`__fixtures__/fakeSdk.ts`).
 */

/** Les 20 routes kanban, par leur constante de registre (`KANBAN_ENDPOINT_CONSTANTS` du SDK). */
export type KanbanEndpoint = KanbanEndpointConstant;

/** La façade `api.kanban` du SDK : six familles de routes, entrées et sorties typées par lui. */
export type KanbanFacade = Pick<Kanban, "board" | "column" | "card" | "comment" | "milestone" | "role">;

export interface KanbanRequestOptions {
  /**
   * Annulation demandée par React Query. Le SDK ne sait pas interrompre une requête partie :
   * le transport refuse de la lancer si le signal est déjà levé, et abandonne la réponse s'il
   * l'est à l'arrivée.
   */
  signal?: AbortSignal;
}

/** Garde de type imposée à chaque appel : elle remplace les casts `as`. */
export type ResponseGuard<T> = (value: unknown) => value is T;

export interface KanbanClient {
  /**
   * Exécute `invoke` sur la façade du SDK et renvoie `data`, validé par `parse`. `endpoint` nomme
   * la route que `invoke` appelle : c'est lui qui donne son `url` à l'erreur en cas d'échec.
   */
  call<T>(endpoint: KanbanEndpoint, invoke: (kanban: KanbanFacade) => Promise<unknown>, parse: ResponseGuard<T>, options?: KanbanRequestOptions): Promise<T>;
}

/**
 * Identifiant de colonne pour le SDK. Le module manipule des colonnes en `string` (`Column._id`,
 * `Card.columnId`), le SDK type les six colonnes d'un board-lien en énumération : le registre
 * vérifie la valeur à l'envoi (schéma `request`), le type ne fait que suivre.
 */
export function sdkColumnId(columnId: string): KanbanColumnId {
  return columnId as KanbanColumnId;
}
