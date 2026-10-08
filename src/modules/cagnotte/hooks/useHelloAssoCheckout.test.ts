// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici :
 *  - la popup s'ouvre avant tout `await`, sinon le navigateur la bloque ;
 *  - la commande part avec le checkout ;
 *  - `onSettled` n'est appelé qu'une fois, avec la facture et les données du clic ;
 *  - tout arrêt (annulation, échec signalé, délai) attend une vérification lancée après la demande ;
 *  - seuls les messages de la popup ouverte comptent, et ils ne décident rien seuls ;
 *  - une vérification sans réponse ne bloque pas les suivantes.
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
  HELLOASSO_STATUS_TIMEOUT_MS,
  useHelloAssoCheckout,
} from "./useHelloAssoCheckout";

const REDIRECT_URL = "https://www.helloasso-sandbox.com/checkout/4242";
const CHECKOUT = { success: 1, content: { id: 4242, redirectUrl: REDIRECT_URL }, bill: "b1" };
const EN_ATTENTE = { success: 1, paid: false, recorded: false, inProgress: false };
const enregistre = (orderId: number) => ({ success: 1, paid: true, recorded: true, inProgress: false, orderId });
/** Commande transmise au serveur avec le checkout. */
const ORDER = { answerId: "ans1", financerId: "u1", fundings: [{ milestoneId: "m1", amount: 25 }] };
/** Données figées au clic, rendues telles quelles à `onSettled`. */
const SNAPSHOT = { montant: 25 };

type Statut = Record<string, unknown> | Error | Promise<Record<string, unknown>>;

/** Monte le hook ; `statuts` est la suite des réponses de `helloassoStatus` (une Error = échec). */
function monter(statuts: Statut[] = []) {
  const popup = { closed: false, close: vi.fn(), location: { href: "" } };
  const open = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  const submit = vi.fn(async (action: string) => {
    if (action === "helloassoPay") return CHECKOUT;
    const suivant = statuts.shift() ?? EN_ATTENTE;
    if (suivant instanceof Error) throw suivant;
    return suivant;
  });
  const onSettled = vi.fn();
  const rendu = renderHook(() => useHelloAssoCheckout({ submit, onSettled }));
  return { result: rendu.result, unmount: rendu.unmount, submit, onSettled, popup, open };
}

async function demarrer(start: (amount: number, order: Record<string, unknown>, snapshot: typeof SNAPSHOT) => Promise<void>) {
  await act(async () => {
    await start(25, ORDER, SNAPSHOT);
  });
}

async function avancer(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function annuler(cancel: () => void) {
  await act(async () => {
    cancel();
    await vi.advanceTimersByTimeAsync(1);
  });
}

/** Message de la page de retour HelloAsso, émis par `source`. */
async function retourPopup(source: unknown, data: Record<string, unknown>) {
  await act(async () => {
    const event = new MessageEvent("message", { data: { source: "helloasso", type: "HELLOASSO_CALLBACK", ...data } });
    Object.defineProperty(event, "source", { value: source });
    window.dispatchEvent(event);
    await vi.advanceTimersByTimeAsync(1);
  });
}

const verifications = (submit: ReturnType<typeof vi.fn>) =>
  submit.mock.calls.filter(([action]) => action === "helloassoStatus").length;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("useHelloAssoCheckout — ouverture", () => {
  it("ouvre la popup avant d'appeler le serveur, puis l'envoie sur le checkout créé avec la commande", async () => {
    const { result, submit, popup, open } = monter();

    await demarrer(result.current.start);

    expect(open.mock.invocationCallOrder[0]).toBeLessThan(submit.mock.invocationCallOrder[0]);
    expect(submit).toHaveBeenCalledWith("helloassoPay", { amount: 25, order: ORDER });
    expect(popup.location.href).toBe(REDIRECT_URL);
    expect(result.current.phase).toBe("waiting");
  });

  it("n'appelle pas le serveur quand la popup est bloquée", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const submit = vi.fn();
    const { result } = renderHook(() => useHelloAssoCheckout({ submit, onSettled: vi.fn() }));

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
    const { result } = renderHook(() => useHelloAssoCheckout({ submit, onSettled: vi.fn() }));

    await demarrer(result.current.start);

    expect(popup.close).toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith(refus, "PaymentConfigPage.toasts.paymentError.title", expect.any(Function));
    expect(result.current.phase).toBe("idle");
  });
});

describe("useHelloAssoCheckout — suivi du paiement", () => {
  it("rend l'enregistrement une seule fois, avec la facture et les données du clic", async () => {
    const { result, onSettled, popup } = monter([EN_ATTENTE, enregistre(777)]);
    await demarrer(result.current.start);

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(onSettled).not.toHaveBeenCalled();

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith({ bill: "b1", recorded: true, reference: "777", error: null }, SNAPSHOT);
    expect(popup.close).toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");

    await avancer(HELLOASSO_POLL_INTERVAL_MS * 3);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("payé mais pas enregistré : rendu en échec, avec la facture à rejouer", async () => {
    const { result, onSettled } = monter([{ success: 1, paid: true, recorded: false, orderId: 5, recordError: "depense not found" }]);
    await demarrer(result.current.start);

    await avancer(HELLOASSO_POLL_INTERVAL_MS);

    expect(onSettled).toHaveBeenCalledWith({ bill: "b1", recorded: false, reference: "5", error: "depense not found" }, SNAPSHOT);
  });

  it("règlement en cours ailleurs (page de retour) : on réinterroge sans conclure", async () => {
    const { result, onSettled } = monter([{ success: 1, paid: false, recorded: false, inProgress: true }, enregistre(1)]);
    await demarrer(result.current.start);

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(onSettled).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("waiting");

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("le retour de la popup déclenche une vérification immédiate", async () => {
    const { result, submit, onSettled, popup } = monter([enregistre(1)]);
    await demarrer(result.current.start);

    await retourPopup(popup, { status: "return", checkoutIntentId: "4242" });

    expect(submit).toHaveBeenCalledWith("helloassoStatus", { checkoutIntentId: "4242" });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("ignore un message qui ne vient pas de la popup", async () => {
    const { result, submit } = monter();
    await demarrer(result.current.start);

    await retourPopup(null, { status: "cancel", checkoutIntentId: "4242" });
    await retourPopup({}, { status: "cancel", checkoutIntentId: "" });

    expect(result.current.phase).toBe("waiting");
    expect(verifications(submit)).toBe(0);
  });

  it("ignore le retour d'un autre checkout", async () => {
    const { result, popup } = monter();
    await demarrer(result.current.start);

    await retourPopup(popup, { status: "cancel", checkoutIntentId: "9999" });

    expect(result.current.phase).toBe("waiting");
  });

  it("le retour sur la page vérifie sans attendre : HelloAsso coupe le lien avec la popup", async () => {
    const { result, submit, onSettled } = monter([enregistre(3)]);
    await demarrer(result.current.start);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(submit).toHaveBeenCalledWith("helloassoStatus", { checkoutIntentId: "4242" });
    expect(onSettled).toHaveBeenCalledWith({ bill: "b1", recorded: true, reference: "3", error: null }, SNAPSHOT);
  });

  it("une erreur de vérification ne coupe pas le suivi", async () => {
    const { result, onSettled } = monter([new Error("HelloAsso indisponible"), enregistre(5)]);
    await demarrer(result.current.start);

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(result.current.phase).toBe("waiting");
    expect(result.current.lastError).toBe("HelloAsso indisponible");

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("une réponse incomplète est une erreur, pas une attente", async () => {
    // Backend sans `helloassoStatus` : l'action inconnue renvoie `[]`.
    const { result } = monter([{}]);
    await demarrer(result.current.start);

    await avancer(HELLOASSO_POLL_INTERVAL_MS);

    expect(result.current.lastError).toBe("PaymentConfigPage.errors.statusInvalid");
    expect(result.current.phase).toBe("waiting");
  });

  it("une vérification sans réponse ne bloque pas les suivantes", async () => {
    const { result, onSettled } = monter([new Promise(() => undefined), enregistre(8)]);
    await demarrer(result.current.start);

    await avancer(HELLOASSO_POLL_INTERVAL_MS + HELLOASSO_STATUS_TIMEOUT_MS);
    expect(result.current.lastError).toBe("PaymentConfigPage.errors.statusTimeout");

    await avancer(HELLOASSO_POLL_INTERVAL_MS);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});

describe("useHelloAssoCheckout — arrêt du suivi", () => {
  it("« Annuler » ferme la popup, vérifie une dernière fois, puis s'arrête sans toast d'erreur", async () => {
    const { result, popup, submit, onSettled } = monter();
    await demarrer(result.current.start);

    await annuler(result.current.cancel);

    expect(popup.close).toHaveBeenCalled();
    expect(verifications(submit)).toBe(1);
    expect(result.current.phase).toBe("idle");
    expect(onSettled).not.toHaveBeenCalled();
    expect(toasts.error).not.toHaveBeenCalled();

    await avancer(HELLOASSO_POLL_INTERVAL_MS * 2);
    expect(verifications(submit)).toBe(1);
  });

  it("« Annuler » juste après le paiement : il est enregistré, pas lâché", async () => {
    const { result, onSettled } = monter([enregistre(42)]);
    await demarrer(result.current.start);

    await annuler(result.current.cancel);

    expect(onSettled).toHaveBeenCalledWith({ bill: "b1", recorded: true, reference: "42", error: null }, SNAPSHOT);
  });

  it("une annulation signalée par la popup vérifie avant d'arrêter", async () => {
    const { result, popup, submit } = monter();
    await demarrer(result.current.start);

    await retourPopup(popup, { status: "cancel", checkoutIntentId: "" });

    expect(verifications(submit)).toBe(1);
    expect(result.current.phase).toBe("idle");
    expect(toasts.error).toHaveBeenCalledWith(expect.any(Error), "PaymentConfigPage.toasts.paymentInterrupted.title", expect.any(Function));
  });

  it("un arrêt demandé pendant une vérification attend une réponse obtenue depuis", async () => {
    let repondre: (statut: Record<string, unknown>) => void = () => undefined;
    const enVol = new Promise<Record<string, unknown>>((resolve) => { repondre = resolve; });
    const { result, submit, onSettled } = monter([enVol, enregistre(9)]);
    await demarrer(result.current.start);
    await avancer(HELLOASSO_POLL_INTERVAL_MS);

    await annuler(result.current.cancel);
    expect(result.current.phase).toBe("checking");

    // La réponse « en attente » date d'avant l'annulation : elle ne décide pas.
    await act(async () => {
      repondre(EN_ATTENTE);
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(verifications(submit)).toBe(2);
    expect(onSettled).toHaveBeenCalledWith({ bill: "b1", recorded: true, reference: "9", error: null }, SNAPSHOT);
  });

  it("abandonne passé le délai d'attente, après une dernière vérification", async () => {
    const { result, onSettled } = monter();
    await demarrer(result.current.start);

    await avancer(HELLOASSO_MAX_WAIT_MS + HELLOASSO_POLL_INTERVAL_MS);

    expect(result.current.phase).toBe("idle");
    expect(onSettled).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith(expect.any(Error), "PaymentConfigPage.toasts.paymentInterrupted.title", expect.any(Function));
  });

  it("dernière vérification impossible : arrêt, avec la référence du checkout", async () => {
    const { result } = monter([new Error("réseau")]);
    await demarrer(result.current.start);

    await annuler(result.current.cancel);

    expect(result.current.phase).toBe("idle");
    expect(toasts.error).toHaveBeenCalledWith(expect.any(Error), "PaymentConfigPage.toasts.paymentUnverified.title", expect.any(Function));
  });

  it("annuler puis relancer : le nouveau checkout est suivi", async () => {
    const { result, onSettled } = monter([EN_ATTENTE, enregistre(11)]);
    await demarrer(result.current.start);
    await annuler(result.current.cancel);

    await demarrer(result.current.start);
    await avancer(HELLOASSO_POLL_INTERVAL_MS);

    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("démontée, la page laisse la popup ouverte : le serveur enregistrera sans elle", async () => {
    const { result, popup, unmount } = monter();
    await demarrer(result.current.start);

    unmount();

    expect(popup.close).not.toHaveBeenCalled();
  });
});
