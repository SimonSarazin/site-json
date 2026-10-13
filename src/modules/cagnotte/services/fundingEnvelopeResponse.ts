import { asRecord, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";

function parseResponse(raw: unknown): UnknownRecord {
  if (typeof raw !== "string") return asRecord(raw);
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Message porté par une valeur d'erreur serveur : chaîne, `errors[].message` (HelloAsso) ou `message`. */
function errorMessageOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const record = asRecord(value);
  const messages = (Array.isArray(record.errors) ? record.errors : [])
    .map((error) => asRecord(error).message)
    .filter((message): message is string => typeof message === "string" && message.trim() !== "");
  if (messages.length > 0) return messages.join(" | ");
  return typeof record.message === "string" ? record.message.trim() : "";
}

/** Message d'erreur d'une réponse : `content`, `error`, puis `message`. */
function responseErrorMessage(response: UnknownRecord): string {
  return errorMessageOf(response.content) || errorMessageOf(response.error) || errorMessageOf(response.message);
}

/**
 * Rend la réponse d'une action de paiement `fundingEnvelope`, ou lève l'erreur signalée par le serveur
 * (`fallbackMessage` s'il n'en donne pas).
 */
export function readFundingEnvelopeResponse(raw: unknown, fallbackMessage: string): UnknownRecord {
  const response = parseResponse(raw);
  const failed =
    response.success === 0 ||
    response.success === false ||
    response.error === true ||
    (typeof response.error === "string" && response.error !== "");

  if (failed) {
    throw new Error(responseErrorMessage(response) || fallbackMessage);
  }
  return response;
}

/** Erreur du SDK avec le message du corps de réponse et son statut HTTP ; sans corps exploitable, telle quelle. */
export function readFundingEnvelopeError(error: unknown): unknown {
  const record = asRecord(error);
  const message = responseErrorMessage(parseResponse(record.details ?? record.responseData));
  if (!message) return error;
  return Object.assign(new Error(message), { status: record.status });
}

/** Issue inconnue (5xx, ou pas de réponse : 500 côté SDK) : le paiement a pu passer. */
export function isUnknownOutcome(error: unknown): boolean {
  const status = asRecord(error).status;
  return typeof status === "number" && status >= 500;
}
