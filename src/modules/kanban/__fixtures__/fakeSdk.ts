import Cocolight from "@communecter/cocolight-api-client";
import { KANBAN_ENDPOINTS } from "@/modules/kanban/transport/kanbanEndpoints";
import type { KanbanSdkClient } from "@/modules/kanban/transport/sdkKanbanClient";

/**
 * Faux du SDK pour les tests du transport et des hooks : un client principal (la session du
 * site) et un pont qui répond route par route.
 *
 * Le pont rend ce que rendrait le vrai SDK : `{data: corps}` sur un 2xx, et une VRAIE
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
  const path = KANBAN_ENDPOINTS.find((entry) => entry.constant === endpoint)?.path ?? endpoint;
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

/** Session minimale : deux jetons, lus et écrits comme sur un `ApiClient`. */
export class FakeSession {
  accessToken: string | null;
  refreshToken: string | null;

  constructor(accessToken: string | null = "jeton", refreshToken: string | null = "rafraichissement") {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  getToken(): string | null {
    return this.accessToken;
  }

  setToken(token: string | null): void {
    this.accessToken = token;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setRefreshToken(token: string | null): void {
    this.refreshToken = token;
  }
}

/** Client principal du site : une session, jamais appelé pour une route kanban. */
export class FakeMainClient extends FakeSession implements KanbanSdkClient {
  async callEndpoint(endpoint: string): Promise<{ data: unknown }> {
    throw new Error(`le client principal ne sert pas les routes kanban (${endpoint})`);
  }
}

/** Appel reçu par le pont. */
export interface BridgeCall {
  route: string;
  body: Record<string, unknown>;
  /** Jeton d'accès porté par le pont au moment de l'appel. */
  token: string | null;
  transform: boolean;
  validate: boolean;
}

/**
 * Pont simulé. Une route sans gestionnaire répond 404 `notFound` : un appel inattendu se voit
 * dans le test au lieu de passer inaperçu.
 */
export class FakeBridge extends FakeSession implements KanbanSdkClient {
  readonly calls: BridgeCall[] = [];
  private readonly handlers: Map<string, RouteHandler>;

  constructor(routes: Record<string, RouteHandler> = {}) {
    super(null, null);
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
    this.calls.push({ route, body, token: this.accessToken, transform, validate });
    const handler = this.handlers.get(route);
    const response = handler ? await handler(body) : refusal(404, "notFound", { route });
    if (response.status >= 200 && response.status < 300) return { data: response.body };
    throw sdkError(response.status, response.body);
  }
}
