import Cocolight from "@communecter/cocolight-api-client";
import { getBaseUrl } from "@/lib/constant/common";
import { KanbanApiError, KanbanAuthError, isKanbanApiError } from "@/modules/kanban/lib/kanbanErrors";
import { isRecord } from "@/modules/kanban/types";
import type { KanbanClient, KanbanRequestOptions, ResponseGuard } from "./kanbanClient";
import { KANBAN_ENDPOINTS, type KanbanEndpoint } from "./kanbanEndpoints";

/**
 * Implémentation SDK du transport kanban.
 *
 * Les routes kanban ne sont pas encore dans le registre du SDK (cf. `kanbanEndpoints.ts`) : on
 * les sert par un client `ApiClient` DÉDIÉ, le « pont », construit avec ces seules routes.
 *
 * Le pont n'a pas de session propre. Avant chaque appel, il prend les jetons du client
 * principal du site. Si le SDK les rafraîchit pendant l'appel (intercepteur 401), il les rend
 * au client principal. Le jeton d'accès vit 10 minutes : sans ce retour, le polling du tableau
 * (toutes les 10 s) referait un rafraîchissement à chaque passe. Ce double rafraîchissement est
 * sûr : le jeton de rafraîchissement de Communecter n'est ni stocké ni révoqué
 * (`RefreshTokenAction`), deux clients peuvent s'en servir.
 *
 * À la livraison des routes dans le SDK, `bridgeFor` disparaît : on appelle `main.callEndpoint`.
 */

/**
 * Ce que le transport utilise d'un `ApiClient` : la session et l'appel d'une route. Un
 * `ApiClient` du SDK le satisfait tel quel ; les tests passent des faux sans simuler le reste.
 */
export interface KanbanSdkClient {
  getToken(): string | null;
  setToken(token: string | null): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string | null): void;
  callEndpoint(endpoint: string, data: object, transformResponseData: boolean, validateResponseSchema: boolean): Promise<{ data: unknown }>;
}

/** Délai d'un appel, celui de co-kanban : au-delà, l'écran propose de réessayer. */
const KANBAN_TIMEOUT_MS = 15_000;

/** Un pont par client principal : au rendu serveur, chaque requête a le sien, ramassé avec lui. */
const bridges = new WeakMap<KanbanSdkClient, KanbanSdkClient>();

function bridgeFor(main: KanbanSdkClient): KanbanSdkClient {
  let bridge = bridges.get(main);
  if (bridge === undefined) {
    // Stockage mémoire (défaut du SDK) : le pont ne persiste rien, la session reste celle
    // du client principal.
    bridge = new Cocolight.ApiClient({ baseURL: getBaseUrl(), endpoints: [...KANBAN_ENDPOINTS], timeout: KANBAN_TIMEOUT_MS });
    bridges.set(main, bridge);
  }
  return bridge;
}

/** Chemin d'une route, pour le diagnostic porté par l'erreur. */
function routeLabel(endpoint: KanbanEndpoint): string {
  return KANBAN_ENDPOINTS.find((entry) => entry.constant === endpoint)?.path ?? endpoint;
}

/**
 * Traduit une erreur du SDK en `KanbanApiError`, la seule erreur que lisent les écrans
 * (classe d'échec, raison fine, perte d'accès). Fonction PURE et exportée pour être testée.
 *
 * Ce que le SDK transmet :
 *  - `ApiClientError(message, status, details)`, `details` étant le CORPS de la réponse. Pour
 *    le kanban, c'est l'enveloppe `{result:false, msg, detail}` avec le vrai statut HTTP ;
 *  - sans réponse (réseau coupé, délai dépassé), le statut vaut 500 et le corps `null`. Un vrai
 *    500 du serveur a toujours un corps (page HTML ou JSON), même vide (`""`) : c'est ce qui
 *    sépare une panne réseau d'une panne serveur. Le délai, lui, ne se lit que dans le
 *    message d'axios (« timeout of … exceeded ») ;
 *  - `CircuitBreakerError` (503) quand le SDK a coupé les appels après des pannes répétées ;
 *  - un 401 quand aucun jeton n'est posé, ou quand le rafraîchissement a échoué.
 *
 * Toute autre valeur levée (bug local) passe telle quelle : la classer « serveur » mentirait.
 */
export function kanbanErrorFromSdk(error: unknown, endpoint: KanbanEndpoint): unknown {
  if (isKanbanApiError(error)) return error;
  const url = routeLabel(endpoint);
  if (error instanceof Cocolight.error.CircuitBreakerError) {
    return new KanbanApiError(error.message, { status: 503, code: "serverError", cause: error, url });
  }
  if (!(error instanceof Cocolight.error.ApiClientError)) return error;

  const { status, details: body } = error;
  if (isRecord(body) && body.result === false) {
    const code = typeof body.msg === "string" ? body.msg : "serverError";
    const options = { status, code, detail: body.detail, cause: error, url };
    return status === 401 ? new KanbanAuthError(code, options) : new KanbanApiError(code, options);
  }
  if (status === 401) return new KanbanAuthError(error.message, { status, cause: error, url });
  if (body === null || body === undefined) {
    const code = /timeout/i.test(error.message) ? "timeout" : "network";
    return new KanbanApiError(error.message, { status: 0, code, cause: error, url });
  }
  // Corps illisible (page d'erreur HTML d'Apache/Yii, action inconnue en 404) : le statut
  // garde la main sur la classe d'échec (`classifyKanbanFailure`).
  return new KanbanApiError(error.message, { status, code: "invalidResponse", detail: body, cause: error, url });
}

/**
 * Déplie l'enveloppe `{result:true, data}` et valide `data` — la règle UNIQUE de co-kanban :
 * toute réponse hors contrat lève, jamais d'objet à moitié vide propagé à l'écran. Un
 * `{result:false}` en HTTP 200 (refus métier du legacy) lève comme un refus HTTP.
 */
export function unwrapKanbanEnvelope<T>(payload: unknown, parse: ResponseGuard<T>, endpoint: KanbanEndpoint, status = 200): T {
  const url = routeLabel(endpoint);
  if (!isRecord(payload) || typeof payload.result !== "boolean") {
    throw new KanbanApiError(`Enveloppe inattendue (${status}) sur ${url}`, { status, code: "invalidResponse", detail: payload, url });
  }
  if (payload.result === false) {
    const code = typeof payload.msg === "string" ? payload.msg : "serverError";
    throw new KanbanApiError(code, { status, code, detail: payload.detail, url });
  }
  if (payload.data === undefined) {
    throw new KanbanApiError(`Enveloppe sans \`data\` (${status}) sur ${url}`, { status, code: "invalidResponse", detail: payload, url });
  }
  if (!parse(payload.data)) {
    throw new KanbanApiError(`Réponse hors contrat sur ${url}`, { status, code: "invalidResponse", detail: payload.data, url });
  }
  return payload.data;
}

function abortReason(signal: AbortSignal, endpoint: KanbanEndpoint): unknown {
  return signal.reason instanceof Error
    ? signal.reason
    : new KanbanApiError("Requête annulée", { code: "aborted", url: routeLabel(endpoint) });
}

/**
 * Transport kanban branché sur le client principal du site.
 *
 * `getMainClient` est relu à CHAQUE appel : le client du contexte peut naître après le
 * composant (initialisation asynchrone), et un client figé à la construction resterait nul.
 * `makeBridge` n'existe que pour les tests.
 */
export function createSdkKanbanClient(
  getMainClient: () => KanbanSdkClient | null,
  makeBridge: (main: KanbanSdkClient) => KanbanSdkClient = bridgeFor,
): KanbanClient {
  async function post<T>(endpoint: KanbanEndpoint, body: object, parse: ResponseGuard<T>, options: KanbanRequestOptions = {}): Promise<T> {
    const { signal } = options;
    if (signal?.aborted) throw abortReason(signal, endpoint);
    const main = getMainClient();
    if (main === null) {
      throw new KanbanAuthError("Client API indisponible", { status: 401, url: routeLabel(endpoint) });
    }

    const bridge = makeBridge(main);
    const accessBefore = main.getToken();
    const refreshBefore = main.getRefreshToken();
    if (bridge.getToken() !== accessBefore) bridge.setToken(accessBefore);
    if (bridge.getRefreshToken() !== refreshBefore) bridge.setRefreshToken(refreshBefore);

    let response: { data: unknown };
    try {
      // `false, false` : ni `_transformData` (normalisations des entités legacy, sans objet
      // ici), ni validation AJV de la réponse (le registre du pont n'en déclare pas).
      response = await bridge.callEndpoint(endpoint, { ...body }, false, false);
    } catch (error) {
      throw kanbanErrorFromSdk(error, endpoint);
    } finally {
      // Jetons rafraîchis par le SDK pendant l'appel : on les rend au client principal. Un
      // `null` (rafraîchissement raté, session du pont remise à zéro) ne remonte PAS : la
      // déconnexion du site n'est pas l'affaire du kanban, le client principal la constatera.
      const accessAfter = bridge.getToken();
      if (accessAfter !== null && accessAfter !== accessBefore) main.setToken(accessAfter);
      const refreshAfter = bridge.getRefreshToken();
      if (refreshAfter !== null && refreshAfter !== refreshBefore) main.setRefreshToken(refreshAfter);
    }

    if (signal?.aborted) throw abortReason(signal, endpoint);
    // Le pont n'a pas de gestionnaire hors ligne : une mise en file n'arrive pas. Si elle
    // arrivait, `data` vaudrait `null` et l'enveloppe lèverait `invalidResponse`.
    return unwrapKanbanEnvelope(response.data, parse, endpoint);
  }

  return { post };
}
