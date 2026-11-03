import Cocolight from "@communecter/cocolight-api-client";
import { KANBAN_ROUTES, type KanbanEndpoint } from "@/modules/kanban/transport/kanbanRoutes";
import type { KanbanSdkClient } from "@/modules/kanban/transport/sdkKanbanClient";

/**
 * Faux du SDK pour les tests du transport, des hooks et des écrans : le client principal du
 * site, qui sert les routes kanban une par une.
 *
 * Il rend ce que rendrait le vrai SDK : `{data: corps}` sur un 2xx, et une VRAIE
 * `ApiClientError(message, statut, corps)` sinon. Les tests traversent donc la traduction
 * d'erreurs et le dépliage d'enveloppe de `sdkKanbanClient.ts`, au lieu de les contourner.
 */

/** Réponse simulée d'une route : statut HTTP et corps. */
export interface FakeResponse {
  status: number;
  body: unknown;
}

/** Succès du module : enveloppe `{result: true, data}`. */
export function ok(data: unknown): FakeResponse {
  return { status: 200, body: { result: true, data } };
}

/** Refus du module : enveloppe `{result: false, msg, detail}` et son statut HTTP. */
export function refusal(status: number, msg: string, detail: Record<string, unknown> = {}): FakeResponse {
  return { status, body: { result: false, msg, detail } };
}

export type RouteHandler = (body: Record<string, unknown>) => FakeResponse | Promise<FakeResponse>;

/** Route courte d'une constante : `KANBAN_BOARD_SYNC_URL` -> `board/sync`. */
function routeOf(endpoint: string): string {
  const path = endpoint in KANBAN_ROUTES ? KANBAN_ROUTES[endpoint as KanbanEndpoint] : endpoint;
  const match = /\/costum\/kanban-([a-z]+)\/([a-z]+)$/.exec(path);
  return match ? `${match[1]}/${match[2]}` : endpoint;
}

/**
 * Erreur levée par le SDK sur un statut non 2xx : `details` porte le corps BRUT de la réponse.
 * Le SDK le type `Record<string, any>`, mais c'est `error.response.data` d'axios : une page HTML
 * y arrive en chaîne, une absence de réponse en `null`. Le cast reproduit cet écart de typage
 * du SDK, celui-là même que le transport doit encaisser.
 */
export function sdkError(status: number, body: unknown, message = `Erreur lors de l'appel de l'API : ${status}`): Error {
  return new Cocolight.error.ApiClientError(message, status, body as Record<string, unknown>);
}

/** Appel reçu par le faux SDK. */
export interface SdkCall {
  route: string;
  body: Record<string, unknown>;
  transform: boolean;
  validate: boolean;
}

/**
 * Client principal simulé. Une route sans gestionnaire répond 404 `notFound` : un appel
 * inattendu se voit dans le test au lieu de passer inaperçu.
 */
export class FakeSdk implements KanbanSdkClient {
  readonly calls: SdkCall[] = [];
  private readonly handlers: Map<string, RouteHandler>;

  constructor(routes: Record<string, RouteHandler> = {}) {
    this.handlers = new Map(Object.entries(routes));
  }

  on(route: string, handler: RouteHandler): void {
    this.handlers.set(route, handler);
  }

  count(route: string): number {
    return this.calls.filter((call) => call.route === route).length;
  }

  async callEndpoint(endpoint: string, data: object, transform: boolean, validate: boolean): Promise<{ data: unknown }> {
    const route = routeOf(endpoint);
    const body: Record<string, unknown> = Object.fromEntries(Object.entries(data));
    this.calls.push({ route, body, transform, validate });
    const handler = this.handlers.get(route);
    const response = handler ? await handler(body) : refusal(404, "notFound", { route });
    if (response.status >= 200 && response.status < 300) return { data: response.body };
    throw sdkError(response.status, response.body);
  }
}
