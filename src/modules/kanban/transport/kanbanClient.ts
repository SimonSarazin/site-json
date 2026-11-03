import type { KanbanEndpoint } from "./kanbanRoutes";

/**
 * Contrat du transport kanban : la SEULE porte du module vers le backend.
 *
 * Même forme que le `KanbanClient` de co-kanban (`src/lib/http.ts`), à une différence près :
 * la route se désigne par sa CONSTANTE de registre, pas par son chemin. Les fonctions de
 * `api/*.ts` et les hooks se reprennent ainsi presque tels quels, et le jour où le SDK livre
 * ces routes, seule l'implémentation change (`sdkKanbanClient.ts`).
 *
 * Une implémentation : celle du SDK (`sdkKanbanClient.ts`), que les tests branchent sur un faux
 * client principal (`__fixtures__/fakeSdk.ts`).
 */

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
  /** Envoie `body` à la route et renvoie `data`, déplié de l'enveloppe et validé par `parse`. */
  post<T>(endpoint: KanbanEndpoint, body: object, parse: ResponseGuard<T>, options?: KanbanRequestOptions): Promise<T>;
}
