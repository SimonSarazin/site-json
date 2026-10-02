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

/**
 * Rend la réponse d'une action de paiement `fundingEnvelope`, ou lève l'erreur signalée par le serveur
 * (`fallbackMessage` s'il n'en donne pas, ex. Stripe 3-D Secure).
 */
export function readFundingEnvelopeResponse(raw: unknown, fallbackMessage: string): UnknownRecord {
  const response = parseResponse(raw);
  const failed =
    response.success === 0 ||
    response.success === false ||
    response.error === true ||
    (typeof response.error === "string" && response.error !== "") ||
    (typeof response.message === "string" && response.message.toLowerCase().includes("error"));

  if (failed) {
    throw new Error(
      errorMessageOf(response.content) ||
        errorMessageOf(response.error) ||
        errorMessageOf(response.message) ||
        fallbackMessage,
    );
  }
  return response;
}
