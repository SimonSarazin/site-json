import { useCallback } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";
import { readFundingEnvelopeError, readFundingEnvelopeResponse } from "@/modules/cagnotte/services/fundingEnvelopeResponse";

export type FundingEnvelopeAction = "stripePay" | "helloassoPay" | "helloassoStatus" | "cagnotteSettle";

export type SubmitFundingEnvelopeAction = (
  action: FundingEnvelopeAction,
  payload: Record<string, unknown>,
) => Promise<UnknownRecord>;

/**
 * Envoie une action de paiement `fundingEnvelope` au nom de l'entité du site, dont le SDK impose le contexte
 * (`contextId`, `contextType`) ; rend la réponse, ou lève l'erreur serveur avec son statut HTTP.
 */
export function useFundingEnvelopeAction(): SubmitFundingEnvelopeAction {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const { entity } = useCocolight();

  return useCallback(async (action, payload) => {
    if (!entity || typeof entity.fundingEnvelope !== "function") {
      throw new Error(String(t("PaymentConfigPage.errors.fundingEnvelopeUnavailable")));
    }
    let rawResponse: unknown;
    try {
      rawResponse = await entity.fundingEnvelope({ action, ...payload });
    } catch (error) {
      throw readFundingEnvelopeError(error);
    }
    return readFundingEnvelopeResponse(rawResponse, String(t("PaymentConfigPage.errors.paymentRejected")));
  }, [entity, t]);
}
