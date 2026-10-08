import { useCallback, useRef, useState } from "react";
import { toString, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";
import type { SubmitFundingEnvelopeAction } from "@/modules/cagnotte/hooks/useFundingEnvelopeAction";

/** Résultat de l'enregistrement serveur d'un paiement encaissé. */
export interface PaymentSettlement {
  /** Facture à rejouer en cas d'échec (`cagnotteSettle`). */
  bill: string;
  recorded: boolean;
  /** Référence chez le prestataire : commande HelloAsso, intention Stripe. */
  reference: string | null;
  error: string | null;
  /** Un autre appel enregistre la facture en ce moment. */
  inProgress?: boolean;
}

export type SettlementStatus = "idle" | "failed" | "done";

const asId = (value: unknown) => (typeof value === "number" ? String(value) : toString(value));

/** Règlement lu dans la réponse de `stripePay` ou `cagnotteSettle`. */
export function readSettlement(response: UnknownRecord, bill = ""): PaymentSettlement {
  return {
    bill: asId(response.bill) || bill,
    recorded: response.recorded === true,
    reference: asId(response.orderId) || asId(response.intent_id) || null,
    error: toString(response.recordError) || null,
    ...(response.inProgress === true ? { inProgress: true } : {}),
  };
}

interface UsePaymentSettlementOptions<T> {
  submit: SubmitFundingEnvelopeAction;
  /** Paiement enregistré, avec les données figées au lancement. */
  onRecorded: (snapshot: T, settlement: PaymentSettlement) => void;
}

/** Suivi de l'enregistrement d'un paiement encaissé ; `retry` le rejoue sur la même facture (`cagnotteSettle`). */
export function usePaymentSettlement<T>({ submit, onRecorded }: UsePaymentSettlementOptions<T>) {
  const [status, setStatus] = useState<SettlementStatus>("idle");
  const [settlement, setSettlement] = useState<PaymentSettlement | null>(null);
  const [retrying, setRetrying] = useState(false);
  const snapshotRef = useRef<{ value: T } | null>(null);
  const retryingRef = useRef(false);

  const settled = useCallback((result: PaymentSettlement, snapshot: T) => {
    snapshotRef.current = { value: snapshot };
    setSettlement(result);
    setStatus(result.recorded ? "done" : "failed");
    if (result.recorded) onRecorded(snapshot, result);
  }, [onRecorded]);

  const retry = useCallback(async () => {
    const snapshot = snapshotRef.current;
    if (!settlement || !snapshot || retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    try {
      const response = await submit("cagnotteSettle", { bill: settlement.bill });
      const next = readSettlement(response, settlement.bill);
      // Un enregistrement en cours ne rappelle pas la référence : garder celle du paiement.
      settled({ ...next, reference: next.reference ?? settlement.reference }, snapshot.value);
    } catch (error) {
      setSettlement({ ...settlement, inProgress: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      retryingRef.current = false;
      setRetrying(false);
    }
  }, [settlement, submit, settled]);

  return { status, settlement, retrying, settled, retry };
}
