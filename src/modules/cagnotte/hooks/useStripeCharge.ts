import { useCallback, useRef, useState } from "react";
import type { Stripe } from "@stripe/stripe-js";
import { showErrorToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { isUnknownOutcome } from "@/modules/cagnotte/services/fundingEnvelopeResponse";
import type { SubmitFundingEnvelopeAction } from "@/modules/cagnotte/hooks/useFundingEnvelopeAction";
import { readSettlement, type PaymentSettlement } from "@/modules/cagnotte/hooks/usePaymentSettlement";
import { toString } from "@/modules/cagnotte/utils/dataTransform";

/** `unconfirmed` : issue inconnue, seul le rejeu de la même requête est proposé. */
export type StripeChargePhase = "idle" | "charging" | "unconfirmed";

interface UseStripeChargeOptions<T> {
  submit: SubmitFundingEnvelopeAction;
  /** Stripe.js de l'entité, pour l'authentification forte (3-D Secure). */
  stripe: Promise<Stripe | null> | null;
  /** Clé `localStorage` d'une tentative non confirmée, reprise à la réouverture. */
  storageKey?: string;
  /** Appelé une fois le débit confirmé, avec le résultat de l'enregistrement et les données figées au lancement. */
  onSettled: (settlement: PaymentSettlement, snapshot: T) => void;
}

/** Clé d'une tentative de paiement : 16 octets aléatoires en hexadécimal. */
function newPaymentKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Conservation d'une tentative : la fenêtre d'idempotence de Stripe. */
const ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;

/** Requête d'une tentative, figée avec sa clé, et données du clic rendues à `onSettled`. */
type Attempt<T> = { payload: Record<string, unknown>; snapshot: T };

/** Tentative gardée sous `storageKey`, si elle a moins de 24 h ; sinon `null`. */
function readAttempt<T>(storageKey: string | undefined): Attempt<T> | null {
  if (!storageKey) return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as
      | (Attempt<T> & { savedAt?: number })
      | null;
    const payload = stored?.payload;
    if (!stored || !payload || typeof payload.key !== "string") return null;
    if (Date.now() - Number(stored.savedAt) > ATTEMPT_TTL_MS) return null;
    return { payload, snapshot: stored.snapshot };
  } catch {
    return null;
  }
}

/** Garde la tentative (ou l'efface avec `null`) ; stockage indisponible : elle ne vit que dans la page. */
function writeAttempt<T>(storageKey: string | undefined, attempt: Attempt<T> | null) {
  if (!storageKey) return;
  try {
    if (attempt) window.localStorage.setItem(storageKey, JSON.stringify({ ...attempt, savedAt: Date.now() }));
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Mode privé ou quota : rien à faire.
  }
}

/**
 * Paiement Stripe débité par le serveur (`stripePay`) avec une clé de tentative : sans réponse, seul le rejeu
 * de la même requête est proposé (pas de double débit). L'authentification forte passe par Stripe.js.
 */
export function useStripeCharge<T>({ submit, stripe, storageKey, onSettled }: UseStripeChargeOptions<T>) {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const [restored] = useState(() => readAttempt<T>(storageKey));
  const [phase, setPhase] = useState<StripeChargePhase>(restored ? "unconfirmed" : "idle");
  const [retrying, setRetrying] = useState(false);
  /** Débit pas encore confirmé par Stripe, ou enregistrement en cours ailleurs. */
  const [inProgress, setInProgress] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  /** Requête de la tentative en cours, figée avec sa clé jusqu'à une issue connue. */
  const pendingRef = useRef<Attempt<T> | null>(restored);
  const inFlightRef = useRef(false);

  /** 3-D Secure par Stripe.js. Refus : erreur affichée ; exception de Stripe.js : issue inconnue (500). */
  const authenticate = useCallback(async (clientSecret: string) => {
    const instance = stripe ? await stripe : null;
    if (!instance || !clientSecret) throw new Error(String(t("StripePaymentForm.errors.notLoaded")));
    const result = await instance.handleNextAction({ clientSecret }).catch((error: unknown) => {
      throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), { status: 500 });
    });
    if (result.error) throw new Error(result.error.message || String(t("PaymentConfigPage.errors.paymentRejected")));
  }, [stripe, t]);

  const send = useCallback(async (replay: boolean) => {
    const pending = pendingRef.current;
    if (!pending || inFlightRef.current) return;
    inFlightRef.current = true;
    if (replay) setRetrying(true);
    else setPhase("charging");
    try {
      let response = await submit("stripePay", pending.payload);
      if (response.requires_action === true) {
        await authenticate(toString(response.client_secret));
        response = await submit("stripePay", pending.payload);
      }
      const settlement = readSettlement(response);
      if (response.paid === false || settlement.inProgress) {
        setInProgress(true);
        setLastError(null);
        setPhase("unconfirmed");
        return;
      }
      pendingRef.current = null;
      writeAttempt(storageKey, null);
      setInProgress(false);
      setLastError(null);
      setPhase("idle");
      onSettled(settlement, pending.snapshot);
    } catch (error) {
      if (isUnknownOutcome(error)) {
        setInProgress(false);
        setLastError(error instanceof Error ? error.message : String(error));
        setPhase("unconfirmed");
        return;
      }
      pendingRef.current = null;
      writeAttempt(storageKey, null);
      setInProgress(false);
      setLastError(null);
      setPhase("idle");
      showErrorToast(error, "PaymentConfigPage.toasts.stripeError.title", t);
    } finally {
      inFlightRef.current = false;
      setRetrying(false);
    }
  }, [submit, authenticate, storageKey, onSettled, t]);

  /** Nouvelle tentative, avec une nouvelle clé ; sans effet tant que la précédente n'a pas d'issue connue. */
  const charge = useCallback(async (payload: Record<string, unknown>, snapshot: T) => {
    if (pendingRef.current) return;
    pendingRef.current = { payload: { ...payload, key: newPaymentKey() }, snapshot };
    writeAttempt(storageKey, pendingRef.current);
    await send(false);
  }, [send, storageKey]);

  /** Rejoue à l'identique la requête de la tentative en cours. */
  const verify = useCallback(() => send(true), [send]);

  return { phase, retrying, inProgress, lastError, charge, verify };
}
