// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici :
 *  - chaque tentative de paiement part avec sa clé ;
 *  - sans réponse (coupure, 5xx), plus de nouvelle tentative : seul le rejeu à l'identique de la même requête ;
 *  - un refus (4xx) rend la main, et la tentative suivante a une nouvelle clé ;
 *  - une authentification forte (3-D Secure) passe par Stripe.js, puis la même requête règle le paiement ;
 *  - une tentative sans issue connue survit à la fermeture de la page (`storageKey`), pas une tentative conclue ;
 *  - `onSettled` n'est appelé qu'une fois le débit confirmé.
 */

vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => undefined }));
vi.mock("@/hooks/useT", () => ({ useT: () => (cle: string) => cle }));

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toastUtils", () => ({
  showSuccessToast: toasts.success,
  showErrorToast: toasts.error,
}));

import { useStripeCharge } from "./useStripeCharge";

const PAYLOAD = { payment_method_id: "pm_1", amount: 25, order: { answerId: "ans1" } };
/** Données figées au clic, rendues telles quelles à `onSettled`. */
const SNAPSHOT = { montant: 25 };
const ENREGISTRE = { success: 1, message: "Paiement réussi !", intent_id: "pi_1", bill: "b1", recorded: true, recordError: null };
const coupure = () => Object.assign(new Error("Network Error"), { status: 500 });

/** Monte le hook ; `reponses` est la suite des réponses de `stripePay` (une Error = échec). */
function monter(
  reponses: Array<Record<string, unknown> | Error>,
  handleNextAction?: ReturnType<typeof vi.fn>,
  storageKey?: string,
) {
  const submit = vi.fn(async (_action: string, _payload: Record<string, unknown>) => {
    const suivante = reponses.shift();
    if (!suivante) throw new Error("réponse non prévue");
    if (suivante instanceof Error) throw suivante;
    return suivante;
  });
  const onSettled = vi.fn();
  const stripe = handleNextAction ? Promise.resolve({ handleNextAction } as never) : null;
  const { result, unmount } = renderHook(() => useStripeCharge({ submit, stripe, storageKey, onSettled }));
  return { result, unmount, submit, onSettled };
}

const AUTHENTIFICATION = { success: 1, requires_action: true, client_secret: "pi_1_secret_2", bill: "b1" };

const envois = (submit: ReturnType<typeof monter>["submit"]) => submit.mock.calls.map(([, payload]) => payload);

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("useStripeCharge", () => {
  it("envoie la commande avec une clé de tentative ; débit enregistré → `onSettled` une fois", async () => {
    const { result, submit, onSettled } = monter([ENREGISTRE]);

    await act(async () => {
      await result.current.charge(PAYLOAD, SNAPSHOT);
    });

    expect(submit).toHaveBeenCalledWith("stripePay", { ...PAYLOAD, key: expect.stringMatching(/^[a-f0-9]{32}$/) });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith({ bill: "b1", recorded: true, reference: "pi_1", error: null }, SNAPSHOT);
    expect(result.current.phase).toBe("idle");
  });

  it("sans réponse : paiement non confirmé ; seule la même requête peut être rejouée", async () => {
    const { result, submit, onSettled } = monter([coupure(), ENREGISTRE]);

    await act(async () => {
      await result.current.charge(PAYLOAD, SNAPSHOT);
    });
    expect(result.current.phase).toBe("unconfirmed");
    expect(result.current.lastError).toBe("Network Error");
    expect(onSettled).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.charge({ ...PAYLOAD, payment_method_id: "pm_2" }, SNAPSHOT);
    });
    expect(submit).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.verify();
    });
    const [premier, rejeu] = envois(submit);
    expect(rejeu).toEqual(premier);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("idle");
  });

  it("refus de la carte : toast, retour au formulaire ; la tentative suivante a une nouvelle clé", async () => {
    const refus = Object.assign(new Error("Your card was declined."), { status: 400 });
    const { result, submit } = monter([refus, ENREGISTRE]);

    await act(async () => {
      await result.current.charge(PAYLOAD, SNAPSHOT);
    });
    expect(result.current.phase).toBe("idle");
    expect(toasts.error).toHaveBeenCalledWith(refus, "PaymentConfigPage.toasts.stripeError.title", expect.any(Function));

    await act(async () => {
      await result.current.charge(PAYLOAD, SNAPSHOT);
    });
    const [premier, second] = envois(submit);
    expect(second.key).not.toBe(premier.key);
  });

  it("rejeu dont le débit n'est pas encore confirmé : reste non confirmé, signalé en cours", async () => {
    const enAttente = { success: 1, paid: false, recorded: false, inProgress: false, orderId: null, recordError: null, bill: "b1" };
    const { result, onSettled } = monter([coupure(), enAttente]);

    await act(async () => {
      await result.current.charge(PAYLOAD, SNAPSHOT);
    });
    await act(async () => {
      await result.current.verify();
    });

    expect(result.current.phase).toBe("unconfirmed");
    expect(result.current.inProgress).toBe(true);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("débité mais non enregistré : rendu avec sa facture, pour la reprise de l'enregistrement", async () => {
    const { result, onSettled } = monter([{ success: 1, intent_id: "pi_1", bill: "b1", recorded: false, recordError: "not allowed" }]);

    await act(async () => {
      await result.current.charge(PAYLOAD, SNAPSHOT);
    });

    expect(onSettled).toHaveBeenCalledWith({ bill: "b1", recorded: false, reference: "pi_1", error: "not allowed" }, SNAPSHOT);
    expect(result.current.phase).toBe("idle");
  });

  it("3-D Secure : authentification par Stripe.js, puis la même requête règle le paiement", async () => {
    const handleNextAction = vi.fn(async () => ({ paymentIntent: { status: "succeeded" } }));
    const { result, submit, onSettled } = monter([AUTHENTIFICATION, ENREGISTRE], handleNextAction);

    await act(async () => {
      await result.current.charge(PAYLOAD, SNAPSHOT);
    });

    expect(handleNextAction).toHaveBeenCalledWith({ clientSecret: "pi_1_secret_2" });
    const [premier, rejeu] = envois(submit);
    expect(rejeu).toEqual(premier);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("idle");
  });

  it("3-D Secure refusé : toast avec le message de Stripe, pas de rejeu ; la tentative suivante a une nouvelle clé", async () => {
    const handleNextAction = vi.fn(async () => ({ error: { message: "Authentification refusée" } }));
    const { result, submit, onSettled } = monter([AUTHENTIFICATION, ENREGISTRE], handleNextAction);

    await act(async () => {
      await result.current.charge(PAYLOAD, SNAPSHOT);
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(onSettled).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
    expect(toasts.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Authentification refusée" }),
      "PaymentConfigPage.toasts.stripeError.title",
      expect.any(Function),
    );

    await act(async () => {
      await result.current.charge(PAYLOAD, SNAPSHOT);
    });
    const [premier, second] = envois(submit);
    expect(second.key).not.toBe(premier.key);
  });

  it("3-D Secure interrompu par une erreur de Stripe.js : issue inconnue, seul le rejeu reste proposé", async () => {
    const handleNextAction = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });
    const { result, onSettled } = monter([AUTHENTIFICATION], handleNextAction);

    await act(async () => {
      await result.current.charge(PAYLOAD, SNAPSHOT);
    });

    expect(result.current.phase).toBe("unconfirmed");
    expect(result.current.lastError).toBe("Failed to fetch");
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("tentative sans issue connue : reprise à la réouverture, en « non confirmé », avec la même requête", async () => {
    const premiere = monter([coupure()], undefined, "cagnotte.stripe.u1.ans1");
    await act(async () => {
      await premiere.result.current.charge(PAYLOAD, SNAPSHOT);
    });
    premiere.unmount();

    const reouverture = monter([ENREGISTRE], undefined, "cagnotte.stripe.u1.ans1");
    expect(reouverture.result.current.phase).toBe("unconfirmed");

    await act(async () => {
      await reouverture.result.current.verify();
    });

    expect(reouverture.submit).toHaveBeenCalledWith("stripePay", envois(premiere.submit)[0]);
    expect(reouverture.onSettled).toHaveBeenCalledWith(expect.objectContaining({ recorded: true }), SNAPSHOT);
    expect(window.localStorage.getItem("cagnotte.stripe.u1.ans1")).toBeNull();
  });

  it("tentative conclue (enregistrée ou refusée) : rien n'est gardé", async () => {
    const reglee = monter([ENREGISTRE], undefined, "cagnotte.stripe.u1.ans1");
    await act(async () => {
      await reglee.result.current.charge(PAYLOAD, SNAPSHOT);
    });
    expect(window.localStorage.getItem("cagnotte.stripe.u1.ans1")).toBeNull();

    const refusee = monter([Object.assign(new Error("Your card was declined."), { status: 400 })], undefined, "cagnotte.stripe.u1.ans1");
    await act(async () => {
      await refusee.result.current.charge(PAYLOAD, SNAPSHOT);
    });
    expect(window.localStorage.getItem("cagnotte.stripe.u1.ans1")).toBeNull();
    expect(monter([], undefined, "cagnotte.stripe.u1.ans1").result.current.phase).toBe("idle");
  });
});
