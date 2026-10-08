import { useCallback } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { normalizeEntityType, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";
import { readFundingEnvelopeResponse } from "@/modules/cagnotte/services/fundingEnvelopeResponse";

export type FundingEnvelopeAction = "stripePay" | "helloassoPay" | "helloassoStatus" | "cagnotteSettle";

export type SubmitFundingEnvelopeAction = (
  action: FundingEnvelopeAction,
  payload: Record<string, unknown>,
) => Promise<UnknownRecord>;

/**
 * Envoie une action de paiement `fundingEnvelope` depuis l'entité du site, dont le SDK impose le contexte ;
 * rend la réponse ou lève l'erreur serveur. `fallbackContextId` ne sert qu'au garde `noContextId`.
 */
export function useFundingEnvelopeAction(fallbackContextId?: string): SubmitFundingEnvelopeAction {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const { entity, contextId, contextType } = useCocolight();

  return useCallback(async (action, payload) => {
    if (!entity || typeof entity.fundingEnvelope !== "function") {
      throw new Error(String(t("PaymentConfigPage.errors.fundingEnvelopeUnavailable")));
    }
    const effectiveContextId = contextId || entity.id || fallbackContextId;
    if (!effectiveContextId) {
      throw new Error(String(t("PaymentConfigPage.errors.noContextId")));
    }
    const rawResponse = await entity.fundingEnvelope({
      contextId: effectiveContextId,
      contextType: normalizeEntityType(contextType || entity.getEntityType?.()) || "projects",
      action,
      ...payload,
    } as Parameters<typeof entity.fundingEnvelope>[0]);
    return readFundingEnvelopeResponse(rawResponse, String(t("PaymentConfigPage.errors.paymentRejected")));
  }, [entity, contextId, contextType, fallbackContextId, t]);
}
