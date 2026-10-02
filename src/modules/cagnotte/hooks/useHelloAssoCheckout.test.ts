// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici :
 *  - la popup s'ouvre avant tout `await`, sinon le navigateur la bloque ;
 *  - un paiement confirmé n'appelle `onPaid` qu'une fois, avec les données figées au lancement ;
 *  - le suivi ne dépend pas du message de la popup, que HelloAsso empêche (Cross-Origin-Opener-Policy) ;
 *  - une erreur de vérification ne coupe pas le suivi d'un paiement peut-être déjà fait.
 */

vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => undefined }));
vi.mock("@/hooks/useT", () => ({ useT: () => (cle: string) => cle }));

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toastUtils", () => ({
  showSuccessToast: toasts.success,
  showErrorToast: toasts.error,
}));

import {
  HELLOASSO_MAX_WAIT_MS,
  HELLOASSO_POLL_INTERVAL_MS,
  useHelloAssoCheckout,
} from "./useHelloAssoCheckout";

const REDIRECT_URL = "https://www.helloasso-sandbox.com/checkout/4242";
const CHECKOUT = { success: 1, content: { id: 4242, redirectUrl: REDIRECT_URL } };
const EN_ATTENTE = { success: 1, paid: false, orderId: null };
/** Données figées au clic, rendues telles quelles à `onPaid`. */
const SNAPSHOT = { montant: 25, repartition: [{ depenseIndex: 0, amount: 25 }] };

/** Monte le hook ; `statuts` est la suite des réponses de `helloassoStatus` (une Error = échec). */
function monter(statuts: Array<Record<string, unknown> | Error> = []) {
  const popup = { closed: false, close: vi.fn(), location: { href: "" } };
  const open = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  const submit = vi.fn(async (action: string) => {
    if (action === "helloassoPay") return CHECKOUT;
    const suivant = statuts.shift() ?? EN_ATTENTE;
    if (suivant instanceof Error) throw suivant;
    return suivant;
  });
  const onPaid = vi.fn();
  const { result } = renderHook(() => useHelloAssoCheckout({ submit, onPaid }));
  return { result, submit, onPaid, popup, open };
}

async function demarrer(start: (amount: number, snapshot: typeof SNAPSHOT) => Promise<void>) {
  await act(async () => {
    await start(25, SNAPSHOT);
  });
}

async function avancer(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function retourPopup(data: Record<string, unknown>) {
  await act(async () => {
    window.dispatchEvent(new MessageEvent("message", { data: { source: "helloasso", type: "HELLOASSO_CALLBACK", ...data } }));
    await vi.advanceTimersByTimeAsync(1);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("useHelloAssoCheckout — ouverture", () => {
  it("ouvre la popup avant d'appeler le serveur, puis l'envoie sur le checkout", async () => {
    const { result, submit, popup, open } = monter();

    await demarrer(result.current.start);

    expect(open.mock.invocationCallOrder[0]).toBeLessThan(submit.mock.invocationCallOrder[0]);
    expect(submit).toHaveBeenCalledWith("helloassoPay", { amount: 25 });
    expect(popup.location.href).toBe(REDIRECT_URL);
    expect(result.current.phase).toBe("waiting");
  });

  it("n'appelle pas le serveur quand la popup est bloquée", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const submit = vi.fn();
    const { result } = renderHook(() => useHelloAssoCheckout({ submit, onPaid: vi.fn() }));

    await demarrer(result.current.start);

    expect(submit).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith(expect.any(Error), "PaymentConfigPage.toasts.paymentError.title", expect.any(Function));
    expect(result.current.phase).toBe("idle");
  });

  it("referme la popup et affiche le message serveur quand le checkout échoue", async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: "" } };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const refus = new Error("Cette organisation n'a pas encore de clé API helloasso");
    const submit = vi.fn(async () => { throw refus; });
    const { result } = renderHook(() => useHelloAssoCheckout({ submit, onPaid: vi.fn() }));

    await demarrer(result.current.start);

    expect(popup.close).toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith(refus, "PaymentConfigPage.toasts.paymentError.title", expect.any(Function));
    expect(result.current.phase).toBe("idle");
  });
});

describe("useHelloAssoCheckout — suivi du paiement", () => {
  it("confirme une seule fois, dès que HelloAsso a joint la commande", async () => {
    const { result, onPaid, popup } = monter([EN_ATTENTE, { success: 1, paid: true, orderId: 777 }]);
    await demarrer(result.current.start);

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(onPaid).not.toHaveBeenCalled();

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith({ checkoutIntentId: "4242", orderId: "777" }, SNAPSHOT);
    expect(popup.close).toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");

    await avancer(HELLOASSO_POLL_INTERVAL_MS * 3);
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("le retour de la popup déclenche une vérification immédiate", async () => {
    const { result, submit, onPaid } = monter([{ success: 1, paid: true, orderId: 1 }]);
    await demarrer(result.current.start);

    await retourPopup({ status: "return", checkoutIntentId: "4242" });

    expect(submit).toHaveBeenCalledWith("helloassoStatus", { checkoutIntentId: "4242" });
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("le retour sur la page vérifie sans attendre : HelloAsso coupe le lien avec la popup", async () => {
    const { result, submit, onPaid } = monter([{ success: 1, paid: true, orderId: 3 }]);
    await demarrer(result.current.start);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(submit).toHaveBeenCalledWith("helloassoStatus", { checkoutIntentId: "4242" });
    expect(onPaid).toHaveBeenCalledWith({ checkoutIntentId: "4242", orderId: "3" }, SNAPSHOT);
  });

  it("une annulation dans HelloAsso arrête le suivi", async () => {
    const { result, submit } = monter();
    await demarrer(result.current.start);

    await retourPopup({ status: "cancel", checkoutIntentId: "" });

    expect(result.current.phase).toBe("idle");
    expect(toasts.error).toHaveBeenCalledWith(expect.any(Error), "PaymentConfigPage.toasts.paymentInterrupted.title", expect.any(Function));
    await avancer(HELLOASSO_POLL_INTERVAL_MS * 2);
    expect(submit).not.toHaveBeenCalledWith("helloassoStatus", expect.anything());
  });

  it("ignore le retour d'un autre checkout", async () => {
    const { result } = monter();
    await demarrer(result.current.start);

    await retourPopup({ status: "cancel", checkoutIntentId: "9999" });

    expect(result.current.phase).toBe("waiting");
  });

  it("une erreur de vérification ne coupe pas le suivi", async () => {
    const { result, onPaid } = monter([new Error("HelloAsso indisponible"), { success: 1, paid: true, orderId: 5 }]);
    await demarrer(result.current.start);

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(result.current.phase).toBe("waiting");
    expect(result.current.lastError).toBe("HelloAsso indisponible");

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("abandonne passé le délai d'attente", async () => {
    const { result, onPaid } = monter();
    await demarrer(result.current.start);

    await avancer(HELLOASSO_MAX_WAIT_MS + HELLOASSO_POLL_INTERVAL_MS);

    expect(result.current.phase).toBe("idle");
    expect(onPaid).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith(expect.any(Error), "PaymentConfigPage.toasts.paymentInterrupted.title", expect.any(Function));
  });

  it("« Annuler » ferme la popup et arrête le suivi", async () => {
    const { result, popup, submit } = monter();
    await demarrer(result.current.start);

    act(() => result.current.cancel());

    expect(popup.close).toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
    await avancer(HELLOASSO_POLL_INTERVAL_MS * 2);
    expect(submit).not.toHaveBeenCalledWith("helloassoStatus", expect.anything());
  });
});
