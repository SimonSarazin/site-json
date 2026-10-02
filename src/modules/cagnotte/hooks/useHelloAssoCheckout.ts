import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { asRecord, toString, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";
import { openHelloAssoPopup, readHelloAssoCheckout } from "@/modules/cagnotte/services/helloAssoCheckoutIntent";
import { readHelloAssoStatus } from "@/modules/cagnotte/services/helloAssoVerification";

/** Intervalle entre deux vérifications du checkout. */
export const HELLOASSO_POLL_INTERVAL_MS = 5_000;
/** Attente maximale ; le lien HelloAsso expire au bout de 15 min. */
export const HELLOASSO_MAX_WAIT_MS = 20 * 60_000;

export type HelloAssoAction = "helloassoPay" | "helloassoStatus";
export type HelloAssoCheckoutPhase = "idle" | "opening" | "waiting";

export interface HelloAssoPayment {
  checkoutIntentId: string;
  orderId?: string;
}

interface UseHelloAssoCheckoutOptions<T> {
  /** Envoie l'action `fundingEnvelope` et rend sa réponse, ou lève l'erreur du serveur. */
  submit: (action: HelloAssoAction, payload: Record<string, unknown>) => Promise<UnknownRecord>;
  /** Appelé une fois par checkout confirmé, avec les données figées au lancement. */
  onPaid: (payment: HelloAssoPayment, snapshot: T) => void;
}

/**
 * Paiement HelloAsso : crée le checkout, l'ouvre en popup et interroge le serveur jusqu'à la
 * confirmation. Le retour sur la page ou le message de la popup vérifie aussitôt ; une annulation arrête.
 */
export function useHelloAssoCheckout<T>({ submit, onPaid }: UseHelloAssoCheckoutOptions<T>) {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const [phase, setPhase] = useState<HelloAssoCheckoutPhase>("idle");
  const [checkoutIntentId, setCheckoutIntentId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  /** Checkout suivi : une réponse arrivée après un arrêt est ignorée. */
  const trackedIdRef = useRef<string | null>(null);
  /** Données du checkout suivi, figées au lancement (montant, répartition…). */
  const snapshotRef = useRef<{ value: T } | null>(null);
  const deadlineRef = useRef(0);
  const checkingRef = useRef(false);

  const stop = useCallback(() => {
    trackedIdRef.current = null;
    snapshotRef.current = null;
    setPhase("idle");
    setCheckoutIntentId(null);
    setLastError(null);
  }, []);

  const closePopup = useCallback(() => {
    popupRef.current?.close();
    popupRef.current = null;
  }, []);

  const interrupt = useCallback(() => {
    stop();
    showErrorToast(
      new Error(String(t("PaymentConfigPage.toasts.paymentInterrupted.description"))),
      "PaymentConfigPage.toasts.paymentInterrupted.title",
      t,
    );
  }, [stop, t]);

  const cancel = useCallback(() => {
    closePopup();
    stop();
  }, [closePopup, stop]);

  /** À appeler dans le gestionnaire de clic (sinon la popup est bloquée) ; `snapshot` est rendu à `onPaid`. */
  const start = useCallback(async (amount: number, snapshot: T) => {
    const popup = openHelloAssoPopup();
    if (!popup) {
      showErrorToast(new Error(String(t("PaymentConfigPage.errors.popupFailed"))), "PaymentConfigPage.toasts.paymentError.title", t);
      return;
    }
    popupRef.current = popup;
    setLastError(null);
    setPhase("opening");
    try {
      const checkout = readHelloAssoCheckout(await submit("helloassoPay", { amount }));
      if (!checkout) throw new Error(String(t("PaymentConfigPage.errors.noRedirectUrl")));
      if (popup.closed) throw new Error(String(t("PaymentConfigPage.toasts.paymentInterrupted.description")));
      popup.location.href = checkout.redirectUrl;
      trackedIdRef.current = checkout.checkoutIntentId;
      snapshotRef.current = { value: snapshot };
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

  /** Une vérification à la fois ; une erreur ne coupe pas le suivi, seul le délai le fait. */
  const verify = useEffectEvent(async (id: string) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const status = readHelloAssoStatus(await submit("helloassoStatus", { checkoutIntentId: id }));
      if (trackedIdRef.current !== id) return;
      if (status.paid) {
        const paid = snapshotRef.current;
        closePopup();
        stop();
        if (paid) onPaid({ checkoutIntentId: id, orderId: status.orderId }, paid.value);
        return;
      }
      setLastError(null);
    } catch (error) {
      if (trackedIdRef.current !== id) return;
      setLastError(error instanceof Error ? error.message : String(error));
    } finally {
      checkingRef.current = false;
    }
    if (trackedIdRef.current === id && Date.now() > deadlineRef.current) interrupt();
  });

  /** Retour de la popup (`co2/views/pay/callback.php`) : annulation, ou vérification immédiate. */
  const onCallback = useEffectEvent((event: MessageEvent) => {
    const data = asRecord(event.data);
    if (data.source !== "helloasso" || data.type !== "HELLOASSO_CALLBACK") return;
    const id = trackedIdRef.current;
    const callbackId = toString(data.checkoutIntentId);
    if (!id || (callbackId && callbackId !== id)) return;
    const status = toString(data.status);
    if (status === "cancel" || status === "error" || status === "failed") {
      interrupt();
      return;
    }
    void verify(id);
  });

  useEffect(() => {
    if (phase !== "waiting" || !checkoutIntentId) return;
    const interval = window.setInterval(() => void verify(checkoutIntentId), HELLOASSO_POLL_INTERVAL_MS);
    const handleMessage = (event: MessageEvent) => onCallback(event);
    // Retour sur la page : vérification immédiate (le message de la popup est souvent bloqué par COOP).
    const handleReturn = () => {
      if (document.visibilityState === "visible") void verify(checkoutIntentId);
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
  }, [phase, checkoutIntentId]);

  return { phase, start, cancel, lastError };
}
