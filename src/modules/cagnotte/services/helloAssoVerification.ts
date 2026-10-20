import type { UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";

export interface HelloAssoStatus {
  /** HelloAsso a joint une commande au checkout. */
  paid: boolean;
  /** Le serveur a enregistré le paiement (engagements et versements). */
  recorded: boolean;
  /** Un autre appel règle la facture en ce moment : réinterroger. */
  inProgress: boolean;
  orderId?: string;
  recordError?: string;
}

/** Statut lu dans la réponse de `helloassoStatus` ; `null` si elle est incomplète, à traiter comme une erreur. */
export const readHelloAssoStatus = (response: UnknownRecord): HelloAssoStatus | null => {
  if (typeof response.paid !== "boolean") return null;
  if (response.paid && typeof response.recorded !== "boolean") return null;
  const orderId = response.orderId;
  const hasOrderId = typeof orderId === "number" || (typeof orderId === "string" && orderId !== "");
  const recordError = typeof response.recordError === "string" && response.recordError !== "" ? response.recordError : undefined;
  return {
    paid: response.paid,
    recorded: response.recorded === true,
    inProgress: response.inProgress === true,
    ...(hasOrderId ? { orderId: String(orderId) } : {}),
    ...(recordError ? { recordError } : {}),
  };
};
