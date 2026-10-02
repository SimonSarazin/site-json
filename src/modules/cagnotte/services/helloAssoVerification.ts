import type { UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";

/** Statut lu dans la réponse de `helloassoStatus` : payé dès que HelloAsso a joint une commande. */
export const readHelloAssoStatus = (response: UnknownRecord): { paid: boolean; orderId?: string } => {
  const orderId = response.orderId;
  const hasOrderId = typeof orderId === "number" || (typeof orderId === "string" && orderId !== "");
  return {
    paid: response.paid === true,
    ...(hasOrderId ? { orderId: String(orderId) } : {}),
  };
};
