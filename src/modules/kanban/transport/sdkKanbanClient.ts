import Cocolight from "@communecter/cocolight-api-client";
import { KanbanApiError, KanbanAuthError, isKanbanApiError } from "@/modules/kanban/lib/kanbanErrors";
import { isRecord } from "@/modules/kanban/types";
import type { KanbanClient, KanbanEndpoint, KanbanFacade, KanbanRequestOptions, ResponseGuard } from "./kanbanClient";
import { kanbanRoutePath } from "./kanbanRoutes";

/**
 * Implémentation SDK du transport kanban : les 20 routes sont dans le registre du SDK (1.0.205,
 * `doc/41-module-kanban-sdk.md`) et servies par la façade `api.kanban.*` de l'`Api` du site.
 * Jeton Bearer, rafraîchissement sur 401, disjoncteur, validation du corps envoyé et de la
 * réponse (schémas `request`/`responses.200` du registre), `null` conservés (`keepNulls`), réponse
 * non transformée (`rawResponse`), enveloppe `{result, data}` dépliée : tout cela est au SDK.
 * Ce fichier traduit ses erreurs en `KanbanApiError` et impose la garde de type du module sur
 * `data` — la règle UNIQUE de co-kanban : toute réponse hors contrat lève, jamais d'objet à
 * moitié vide propagé à l'écran.
 */

/** Ce que le transport utilise de l'`Api` du site : sa façade kanban. Un faux la sert dans les tests. */
export interface KanbanSdkApi {
  readonly kanban: KanbanFacade;
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
 * Ce que la façade `api.kanban.*` laisse remonter :
 *  - `ApiAuthenticationError` (401) AVANT tout appel, quand l'`Api` du site n'est pas connectée ;
 *  - `ApiResponseError` sur un `{result:false}` servi en HTTP 200 (refus métier du legacy) :
 *    `responseData` est l'enveloppe, `msg` son code ;
 *  - `ApiValidationError` quand la réponse ne passe pas le schéma `responses.200` du registre ;
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
  const sdkErrors = Cocolight.error;
  if (error instanceof sdkErrors.CircuitBreakerError) {
    return new KanbanApiError(error.message, { status: 503, code: "serverError", cause: error, url });
  }
  if (error instanceof sdkErrors.ApiAuthenticationError) {
    return new KanbanAuthError(error.message, { status: 401, cause: error, url });
  }
  if (error instanceof sdkErrors.ApiResponseError) {
    const body: unknown = error.responseData;
    const code = isRecord(body) && typeof body.msg === "string" ? body.msg : "serverError";
    const detail = isRecord(body) ? body.detail : body;
    return new KanbanApiError(code, { status: error.status, code, detail, cause: error, url });
  }
  if (error instanceof sdkErrors.ApiValidationError) {
    return new KanbanApiError(`Réponse hors schéma sur ${url} : ${error.messages.join(" ; ")}`, {
      status: error.status,
      code: "invalidResponse",
      detail: error.details,
      cause: error,
      url,
    });
  }
  if (!(error instanceof sdkErrors.ApiClientError)) return error;

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
 * Valide le `data` que la façade a déplié de l'enveloppe `{result:true, data}`. Un `data` absent
 * (réponse qui n'était pas une enveloppe : page HTML en 200, mise en file hors-ligne du SDK) ou
 * refusé par la garde lève `invalidResponse`.
 */
export function parseKanbanData<T>(data: unknown, parse: ResponseGuard<T>, endpoint: KanbanEndpoint): T {
  const url = kanbanRoutePath(endpoint);
  if (data === undefined || data === null) {
    throw new KanbanApiError(`Réponse sans \`data\` sur ${url}`, { status: 200, code: "invalidResponse", detail: data, url });
  }
  if (!parse(data)) {
    throw new KanbanApiError(`Réponse hors contrat sur ${url}`, { status: 200, code: "invalidResponse", detail: data, url });
  }
  return data;
}

function abortReason(signal: AbortSignal, endpoint: KanbanEndpoint): unknown {
  return signal.reason instanceof Error
    ? signal.reason
    : new KanbanApiError("Requête annulée", { code: "aborted", url: kanbanRoutePath(endpoint) });
}

/**
 * Transport kanban branché sur la façade `api.kanban` de l'`Api` du site.
 *
 * `getApi` est relu à CHAQUE appel : l'`Api` du contexte change d'identité à la connexion et à
 * la déconnexion, et peut naître après le composant ; une référence figée à la construction
 * resterait nulle ou périmée.
 */
export function createSdkKanbanClient(getApi: () => KanbanSdkApi | null): KanbanClient {
  async function call<T>(
    endpoint: KanbanEndpoint,
    invoke: (kanban: KanbanFacade) => Promise<unknown>,
    parse: ResponseGuard<T>,
    options: KanbanRequestOptions = {},
  ): Promise<T> {
    const { signal } = options;
    if (signal?.aborted) throw abortReason(signal, endpoint);
    const api = getApi();
    if (api === null) {
      throw new KanbanAuthError("Client API indisponible", { status: 401, url: kanbanRoutePath(endpoint) });
    }

    let data: unknown;
    try {
      data = await invoke(api.kanban);
    } catch (error) {
      throw kanbanErrorFromSdk(error, endpoint);
    }

    if (signal?.aborted) throw abortReason(signal, endpoint);
    return parseKanbanData(data, parse, endpoint);
  }

  return { call };
}
