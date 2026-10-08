import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { asRecord, toString } from "@/modules/cagnotte/utils/dataTransform";
import { openHelloAssoPopup, readHelloAssoCheckout } from "@/modules/cagnotte/services/helloAssoCheckoutIntent";
import { readHelloAssoStatus, type HelloAssoStatus } from "@/modules/cagnotte/services/helloAssoVerification";
import type { SubmitFundingEnvelopeAction } from "@/modules/cagnotte/hooks/useFundingEnvelopeAction";
import type { PaymentSettlement } from "@/modules/cagnotte/hooks/usePaymentSettlement";

/** Intervalle entre deux vérifications du checkout. */
export const HELLOASSO_POLL_INTERVAL_MS = 5_000;
/** Attente maximale ; le lien HelloAsso expire au bout de 15 min. */
export const HELLOASSO_MAX_WAIT_MS = 20 * 60_000;
/** Délai max d'une vérification ; au-delà, elle échoue et la suivante peut partir. */
export const HELLOASSO_STATUS_TIMEOUT_MS = 15_000;

/** `checking` : arrêt demandé, une dernière vérification décide. */
export type HelloAssoCheckoutPhase = "idle" | "opening" | "waiting" | "checking";
type StopReason = "cancel" | "failed" | "timeout";

/** Statuts de la page de retour (`co2/views/pay/callback.php`) qui demandent l'arrêt du suivi. */
const STOP_STATUSES = new Set(["cancel", "error", "failed"]);

interface UseHelloAssoCheckoutOptions<T> {
  submit: SubmitFundingEnvelopeAction;
  /** Appelé une fois par checkout payé, avec le résultat de l'enregistrement et les données figées au lancement. */
  onSettled: (settlement: PaymentSettlement, snapshot: T) => void;
}

/** Rejette si la promesse ne se règle pas dans le délai ; un résultat tardif est ignoré. */
function withTimeout<R>(promise: Promise<R>, ms: number, message: string): Promise<R> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Paiement HelloAsso : crée le checkout avec la commande, l'ouvre en popup et interroge le serveur jusqu'à
 * l'enregistrement. Tout arrêt passe par une dernière vérification.
 */
export function useHelloAssoCheckout<T>({ submit, onSettled }: UseHelloAssoCheckoutOptions<T>) {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const [phase, setPhase] = useState<HelloAssoCheckoutPhase>("idle");
  const [checkoutIntentId, setCheckoutIntentId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  /** Checkout suivi : une réponse arrivée après un arrêt est ignorée. */
  const trackedIdRef = useRef<string | null>(null);
  /** Facture et données du checkout suivi, figées au lancement. */
  const trackedRef = useRef<{ bill: string; snapshot: T } | null>(null);
  const deadlineRef = useRef(0);
  /** Checkout dont une vérification est en vol. */
  const inFlightRef = useRef<string | null>(null);
  const stopReasonRef = useRef<StopReason | null>(null);

  const stop = useCallback(() => {
    trackedIdRef.current = null;
    trackedRef.current = null;
    inFlightRef.current = null;
    stopReasonRef.current = null;
    setPhase("idle");
    setCheckoutIntentId(null);
    setLastError(null);
  }, []);

  const closePopup = useCallback(() => {
    popupRef.current?.close();
    popupRef.current = null;
  }, []);

  const requestStop = useCallback((reason: StopReason) => {
    if (!trackedIdRef.current || stopReasonRef.current) return;
    stopReasonRef.current = reason;
    closePopup();
    setPhase("checking");
  }, [closePopup]);

  const cancel = useCallback(() => requestStop("cancel"), [requestStop]);

  /** À appeler dans le gestionnaire de clic (sinon la popup est bloquée) ; `snapshot` est rendu à `onSettled`. */
  const start = useCallback(async (amount: number, order: Record<string, unknown>, snapshot: T) => {
    const popup = openHelloAssoPopup();
    if (!popup) {
      showErrorToast(new Error(String(t("PaymentConfigPage.errors.popupFailed"))), "PaymentConfigPage.toasts.paymentError.title", t);
      return;
    }
    popupRef.current = popup;
    setLastError(null);
    setPhase("opening");
    try {
      const response = await submit("helloassoPay", { amount, order });
      const checkout = readHelloAssoCheckout(response);
      if (!checkout) throw new Error(String(t("PaymentConfigPage.errors.noRedirectUrl")));
      if (popup.closed) throw new Error(String(t("PaymentConfigPage.toasts.paymentInterrupted.description")));
      popup.location.href = checkout.redirectUrl;
      trackedIdRef.current = checkout.checkoutIntentId;
      trackedRef.current = { bill: toString(response.bill), snapshot };
      deadlineRef.current = Date.now() + HELLOASSO_MAX_WAIT_MS;
      setCheckoutIntentId(checkout.checkoutIntentId);
      setPhase("waiting");
      showSuccessToast("PaymentConfigPage.toasts.paymentInProgress.title", t);
    } catch (error) {
      closePopup();
      setPhase("idle");
      showErrorToast(error, "PaymentConfigPage.toasts.paymentError.title", t);
    }
  }, [submit, t, closePopup]);

  /**
   * Interroge le serveur, qui enregistre le paiement une fois confirmé. Une erreur ne coupe pas le suivi ;
   * après une demande d'arrêt, seule une vérification lancée depuis décide.
   */
  const verify = useEffectEvent(async (id: string) => {
    if (inFlightRef.current === id) return;
    inFlightRef.current = id;
    const final = stopReasonRef.current !== null;
    let status: HelloAssoStatus | null = null;
    let failure: string | null = null;
    try {
      const response = await withTimeout(
        submit("helloassoStatus", { checkoutIntentId: id }),
        HELLOASSO_STATUS_TIMEOUT_MS,
        String(t("PaymentConfigPage.errors.statusTimeout")),
      );
      status = readHelloAssoStatus(response);
      if (!status) failure = String(t("PaymentConfigPage.errors.statusInvalid"));
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    } finally {
      if (inFlightRef.current === id) inFlightRef.current = null;
    }
    if (trackedIdRef.current !== id) return;

    if (status?.paid && !status.inProgress) {
      const tracked = trackedRef.current;
      closePopup();
      stop();
      if (tracked) {
        onSettled(
          { bill: tracked.bill, recorded: status.recorded, reference: status.orderId ?? id, error: status.recordError ?? null },
          tracked.snapshot,
        );
      }
      return;
    }
    const reason = stopReasonRef.current;
    if (!reason || status?.inProgress) {
      setLastError(failure);
      return;
    }
    if (!final) {
      void verify(id);
      return;
    }
    stop();
    if (failure) {
      showErrorToast(
        new Error(String(t("PaymentConfigPage.toasts.paymentUnverified.description", undefined, { reference: id }))),
        "PaymentConfigPage.toasts.paymentUnverified.title",
        t,
      );
    } else if (reason !== "cancel") {
      showErrorToast(
        new Error(String(t("PaymentConfigPage.toasts.paymentInterrupted.description"))),
        "PaymentConfigPage.toasts.paymentInterrupted.title",
        t,
      );
    }
  });

  /** Message de la popup : un échec demande l'arrêt, sinon une vérification. */
  const onCallback = useEffectEvent((event: MessageEvent) => {
    if (!popupRef.current || event.source !== popupRef.current) return;
    const data = asRecord(event.data);
    if (data.source !== "helloasso" || data.type !== "HELLOASSO_CALLBACK") return;
    const id = trackedIdRef.current;
    const callbackId = toString(data.checkoutIntentId);
    if (!id || (callbackId && callbackId !== id)) return;
    if (STOP_STATUSES.has(toString(data.status))) requestStop("failed");
    else void verify(id);
  });

  useEffect(() => {
    if ((phase !== "waiting" && phase !== "checking") || !checkoutIntentId) return;
    const id = checkoutIntentId;
    const waiting = phase === "waiting";
    if (!waiting) void verify(id);
    const interval = window.setInterval(() => {
      if (waiting && Date.now() > deadlineRef.current) requestStop("timeout");
      else void verify(id);
    }, HELLOASSO_POLL_INTERVAL_MS);
    if (!waiting) return () => window.clearInterval(interval);

    const handleMessage = (event: MessageEvent) => onCallback(event);
    // Retour sur la page : vérification immédiate (le message de la popup est souvent bloqué par COOP).
    const handleReturn = () => {
      if (document.visibilityState === "visible") void verify(id);
    };
    window.addEventListener("message", handleMessage);
    window.addEventListener("focus", handleReturn);
    document.addEventListener("visibilitychange", handleReturn);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("focus", handleReturn);
      document.removeEventListener("visibilitychange", handleReturn);
    };
  }, [phase, checkoutIntentId, requestStop]);

  // Démontage : réponses tardives ignorées, popup laissée ouverte.
  useEffect(() => () => {
    trackedIdRef.current = null;
  }, []);

  return { phase, start, cancel, lastError };
}
