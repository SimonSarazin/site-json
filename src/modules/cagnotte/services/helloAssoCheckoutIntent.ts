/**
 * Checkout HelloAsso : lecture de la réponse de `helloassoPay` et ouverture de la popup de paiement.
 */

import { asRecord, toString, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";

/** Checkout renvoyé par `helloassoPay` (`content: {id, redirectUrl}`) ; `null` s'il est incomplet. */
export const readHelloAssoCheckout = (
  response: UnknownRecord
): { checkoutIntentId: string; redirectUrl: string } | null => {
  const content = asRecord(response.content);
  const redirectUrl = toString(content.redirectUrl) || toString(response.redirectUrl);
  const id = content.id ?? response.checkoutIntentId ?? response.id;
  const checkoutIntentId = typeof id === "number" || typeof id === "string" ? String(id) : "";
  return redirectUrl && checkoutIntentId ? { checkoutIntentId, redirectUrl } : null;
};

/** Ouvre une popup vide, à appeler pendant le clic (après un `await`, le navigateur la bloque). */
export const openHelloAssoPopup = (): Window | null =>
  window.open(
    "",
    "helloasso-payment",
    "width=680,height=760,left=120,top=60,toolbar=no,menubar=no,scrollbars=yes,resizable=yes,status=no"
  );
