import Cocolight from "@communecter/cocolight-api-client";
import type { KanbanFacade } from "@/modules/kanban/transport/kanbanClient";
import type { KanbanSdkApi } from "@/modules/kanban/transport/sdkKanbanClient";
import { isRecord } from "@/modules/kanban/types";

/**
 * Faux de l'`Api` du site pour les tests du transport, des hooks et des écrans : sa façade
 * `kanban` sert les routes une par une, sous leur nom court (`board/sync`, `card/update`…).
 *
 * Il rend ce que rendrait la vraie façade : `data` déplié sur un `{result: true}` en 2xx, une
 * VRAIE `ApiResponseError` sur un `{result: false}` en 2xx, et une VRAIE
 * `ApiClientError(message, statut, corps)` sur un statut d'erreur. Les tests traversent donc la
 * traduction d'erreurs et la garde de `sdkKanbanClient.ts`, au lieu de les contourner.
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

/**
 * Erreur levée par le SDK sur un statut non 2xx : `details` porte le corps BRUT de la réponse.
 * Le SDK le type `Record<string, any>`, mais c'est `error.response.data` d'axios : une page HTML
 * y arrive en chaîne, une absence de réponse en `null`. Le cast reproduit cet écart de typage
 * du SDK, celui-là même que le transport doit encaisser.
 */
export function sdkError(status: number, body: unknown, message = `Erreur lors de l'appel de l'API : ${status}`): Error {
  return new Cocolight.error.ApiClientError(message, status, body as Record<string, unknown>);
}

/** Appel reçu par la façade simulée. */
export interface SdkCall {
  route: string;
  body: Record<string, unknown>;
}

/**
 * `Api` simulée. Une route sans gestionnaire répond 404 `notFound` : un appel inattendu se voit
 * dans le test au lieu de passer inaperçu.
 */
export class FakeSdk implements KanbanSdkApi {
  readonly calls: SdkCall[] = [];
  readonly kanban: KanbanFacade;
  private readonly handlers: Map<string, RouteHandler>;

  constructor(routes: Record<string, RouteHandler> = {}) {
    this.handlers = new Map(Object.entries(routes));
    // Chaque méthode de la façade sert sa route ; `Promise<never>` se glisse sous tout type de retour.
    const route = (name: string) => (input: object) => this.serve(name, input) as Promise<never>;
    this.kanban = {
      board: { create: route("board/create"), get: route("board/get"), sync: route("board/sync") },
      column: { move: route("column/move") },
      card: { create: route("card/create"), get: route("card/get"), update: route("card/update"), move: route("card/move"), archive: route("card/archive") },
      comment: { list: route("comment/list"), add: route("comment/add"), delete: route("comment/delete") },
      milestone: { list: route("milestone/list"), create: route("milestone/create"), update: route("milestone/update") },
      role: { list: route("role/list"), create: route("role/create"), assign: route("role/assign"), unassign: route("role/unassign"), delete: route("role/delete") },
    };
  }

  on(route: string, handler: RouteHandler): void {
    this.handlers.set(route, handler);
  }

  count(route: string): number {
    return this.calls.filter((call) => call.route === route).length;
  }

  private async serve(route: string, input: object): Promise<unknown> {
    const body: Record<string, unknown> = Object.fromEntries(Object.entries(input));
    this.calls.push({ route, body });
    const handler = this.handlers.get(route);
    const response = handler ? await handler(body) : refusal(404, "notFound", { route });
    if (response.status < 200 || response.status >= 300) throw sdkError(response.status, response.body);
    // Ce que fait la vraie façade en 2xx : `checkAndThrowApiResponseError` lève sur `{result:false}`,
    // `Kanban.unwrap` rend `data`.
    const payload = response.body;
    if (isRecord(payload) && payload.result === false) {
      throw new Cocolight.error.ApiResponseError(typeof payload.msg === "string" ? payload.msg : "Erreur inconnue", response.status, payload);
    }
    return isRecord(payload) ? payload.data : undefined;
  }
}
