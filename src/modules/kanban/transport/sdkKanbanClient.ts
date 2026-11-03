import Cocolight from "@communecter/cocolight-api-client";
import { KanbanApiError, KanbanAuthError, isKanbanApiError } from "@/modules/kanban/lib/kanbanErrors";
import { isRecord } from "@/modules/kanban/types";
import type { KanbanClient, KanbanRequestOptions, ResponseGuard } from "./kanbanClient";
import { kanbanRoutePath, type KanbanEndpoint } from "./kanbanRoutes";

/**
 * Implémentation SDK du transport kanban : les 20 routes sont dans le registre du SDK (1.0.205,
 * `doc/41-module-kanban-sdk.md`), l'appel passe par le client principal du site —
 * `callEndpoint(constante, corps, false, false)`. Jeton Bearer, rafraîchissement sur 401,
 * disjoncteur et erreurs typées sont ceux du SDK ; ce fichier ne fait que traduire ses erreurs en
 * `KanbanApiError` et déplier l'enveloppe `{result, data}`.
 *
 * `false, false` : ni `_transformData` (normalisations des entités legacy, sans objet ici : dates en
 * secondes, `_id` en chaîne), ni validation AJV de la réponse (le registre n'en déclare pas, les
 * gardes de `types.ts` font foi).
 */

/**
 * Ce que le transport utilise d'un `ApiClient` : l'appel d'une route par sa constante. Un
 * `ApiClient` du SDK le satisfait tel quel ; les tests passent un faux qui sert les routes.
 */
export interface KanbanSdkClient {
  callEndpoint(endpoint: string, data: object, transformResponseData: boolean, validateResponseSchema: boolean): Promise<{ data: unknown }>;
}

/**
 * Message de l'intercepteur 401 du SDK quand le rafraîchissement du jeton échoue. Cette erreur naît
 * DANS `callEndpoint`, dont le `catch` la ré-emballe sans `response` : statut 500, corps `null` — la
 * forme d'une panne réseau. Seul le message la distingue.
 */
const REFRESH_FAILED = /rafra[iî]chissement du token/i;

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
 *    message d'axios (« timeout of … exceeded ») ; un rafraîchissement de jeton raté, que dans
 *    le sien (`REFRESH_FAILED`) — le SDK a alors remis la session du site à zéro ;
 *  - `CircuitBreakerError` (503) quand le SDK a coupé les appels après des pannes répétées ;
 *  - un 401 quand aucun jeton n'est posé.
 *
 * Toute autre valeur levée (bug local) passe telle quelle : la classer « serveur » mentirait.
 */
export function kanbanErrorFromSdk(error: unknown, endpoint: KanbanEndpoint): unknown {
  if (isKanbanApiError(error)) return error;
  const url = kanbanRoutePath(endpoint);
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
  if (status === 401 || REFRESH_FAILED.test(error.message)) {
    return new KanbanAuthError(error.message, { status: 401, cause: error, url });
  }
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
  const url = kanbanRoutePath(endpoint);
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
    : new KanbanApiError("Requête annulée", { code: "aborted", url: kanbanRoutePath(endpoint) });
}

/**
 * Transport kanban branché sur le client principal du site.
 *
 * `getClient` est relu à CHAQUE appel : le client du contexte peut naître après le composant
 * (initialisation asynchrone), et un client figé à la construction resterait nul.
 */
export function createSdkKanbanClient(getClient: () => KanbanSdkClient | null): KanbanClient {
  async function post<T>(endpoint: KanbanEndpoint, body: object, parse: ResponseGuard<T>, options: KanbanRequestOptions = {}): Promise<T> {
    const { signal } = options;
    if (signal?.aborted) throw abortReason(signal, endpoint);
    const sdk = getClient();
    if (sdk === null) {
      throw new KanbanAuthError("Client API indisponible", { status: 401, url: kanbanRoutePath(endpoint) });
    }

    let response: { data: unknown };
    try {
      response = await sdk.callEndpoint(endpoint, { ...body }, false, false);
    } catch (error) {
      throw kanbanErrorFromSdk(error, endpoint);
    }

    if (signal?.aborted) throw abortReason(signal, endpoint);
    // Client hors ligne ou disjoncteur ouvert AVEC gestionnaire hors-ligne : le SDK met en file et rend
    // `{data: null, offline|breaker: true}` au lieu d'appeler. Le site ne configure pas ce gestionnaire ;
    // s'il le faisait, `data` vaudrait `null` et l'enveloppe lèverait `invalidResponse` — une mutation
    // kanban rejouée plus tard sans sa réponse n'a pas de sens pour un tableau synchronisé par polling.
    return unwrapKanbanEnvelope(response.data, parse, endpoint);
  }

  return { post };
}
