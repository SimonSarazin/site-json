// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), notify: vi.fn() }));
// Une nouvelle fonction à chaque rendu : le hook ne doit pas en dépendre.
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelopeAction", () => ({
  useFundingEnvelopeAction: () => (...args: unknown[]) => mocks.submit(...args),
}));
vi.mock("@/modules/cagnotte/utils/pledgeHolder", () => ({ getPledgeHolder: () => "onglet-test-1" }));
vi.mock("@/modules/cagnotte/utils/pledgeChanges", () => ({ notifyPledgeChange: mocks.notify }));

const { usePledgeSelectionHold } = await import("./usePledgeSelectionHold");

const promesse = (id: string, finkey: string) =>
  ({ id, finkey, resourceId: "ans1", depenseIndex: 2, financerId: "u1", fundingAmount: 100 }) as never;
const A = promesse("pa", "a-a");

type Props = Parameters<typeof usePledgeSelectionHold>[0];
let queryClient: QueryClient;
const monter = (props: Props) =>
  renderHook((p: Props) => usePledgeSelectionHold(p), {
    initialProps: props,
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  });

beforeEach(() => {
  vi.useFakeTimers();
  queryClient = new QueryClient();
  mocks.submit.mockReset();
  mocks.submit.mockResolvedValue({ success: 1, held: [], refused: [] });
  mocks.notify.mockReset();
});
afterEach(() => {
  delete (document as unknown as Record<string, unknown>).visibilityState;
  delete (document as unknown as Record<string, unknown>).hidden;
  vi.useRealTimers();
});

/** Rend la page visible ou masquée, comme un changement d'onglet. */
async function visibilite(etat: "visible" | "hidden") {
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => etat });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => etat === "hidden" });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(1);
  });
}

describe("usePledgeSelectionHold", () => {
  it("envoie la sélection complète de l'onglet après 300 ms, avec la position de dépense à défaut de clé", async () => {
    monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    expect(mocks.submit).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(mocks.submit).toHaveBeenCalledWith("pledgeSelection", {
      selection: [{ answerId: "ans1", depenseKey: "2", financerId: "u1", finkey: "a-a" }],
      holder: "onglet-test-1",
    });
  });

  it("renouvelle toutes les 5 min tant que la sélection n'est pas vide", async () => {
    monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300 + 5 * 60 * 1000);
    });
    expect(mocks.submit).toHaveBeenCalledTimes(2);
  });

  it("transmet les refus, par finkey", async () => {
    mocks.submit.mockResolvedValue({ success: 1, held: [], refused: [{ finkey: "a-a", reason: "heldByOther" }] });
    const onRefused = vi.fn();
    monter({ enabled: true, open: true, selected: [A], onRefused });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(onRefused).toHaveBeenCalledWith(new Map([["a-a", "heldByOther"]]));
  });

  it("raison inconnue : comptée comme paiement en cours ; refus sans finkey ignoré", async () => {
    mocks.submit.mockResolvedValue({
      success: 1,
      held: [],
      refused: [{ finkey: "a-a", reason: "raisonFuture" }, { reason: "heldByOther" }],
    });
    const onRefused = vi.fn();
    monter({ enabled: true, open: true, selected: [A], onRefused });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(onRefused).toHaveBeenCalledWith(new Map([["a-a", "paymentInProgress"]]));
  });

  it("chaque réponse fait relire les paiements en cours, refus du serveur compris", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    mocks.submit.mockRejectedValueOnce(new Error("hors ligne"));
    monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["cagnotte-pledges-in-progress"] });
  });

  it("fermeture de la modale : la sélection de l'onglet est vidée côté serveur", async () => {
    const { rerender } = monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    mocks.submit.mockClear();

    rerender({ enabled: true, open: false, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.submit).toHaveBeenCalledWith("pledgeSelection", { selection: [], holder: "onglet-test-1" });
  });

  it("fermeture pendant un envoi en vol : la levée part après sa réponse", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mocks.submit.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const { rerender } = monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    rerender({ enabled: true, open: false, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.submit).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ success: 1, held: ["a-a"], refused: [] });
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.submit).toHaveBeenCalledTimes(2);
    expect(mocks.submit).toHaveBeenLastCalledWith("pledgeSelection", { selection: [], holder: "onglet-test-1" });
  });

  it("flush : la sélection en attente part aussitôt, une seule fois", async () => {
    const { result, rerender } = monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    mocks.submit.mockClear();

    rerender({ enabled: true, open: true, selected: [], onRefused: vi.fn() });
    await act(async () => {
      await result.current.flush();
    });
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.submit).toHaveBeenCalledWith("pledgeSelection", { selection: [], holder: "onglet-test-1" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(mocks.submit).toHaveBeenCalledTimes(1);
  });

  it("flush sans envoi en attente : attend la dernière réponse, sans renvoyer", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mocks.submit.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const { result } = monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    let done = false;
    const flushed = result.current.flush().then(() => { done = true; });
    await act(async () => {
      await Promise.resolve();
    });
    expect(done).toBe(false);
    await act(async () => {
      resolve({ success: 1, held: ["a-a"], refused: [] });
      await flushed;
    });
    expect(done).toBe(true);
    expect(mocks.submit).toHaveBeenCalledTimes(1);
  });

  it("un nouveau rendu, rappels neufs compris, ne lève ni ne renvoie la sélection", async () => {
    const { rerender } = monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    mocks.submit.mockClear();

    rerender({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    rerender({ enabled: true, open: true, selected: [{ ...(A as object) } as never], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("ouvrir puis fermer sans rien cocher : aucun envoi", async () => {
    const { unmount } = monter({ enabled: true, open: true, selected: [], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("sélection revenue à celle déjà envoyée avant 300 ms : aucun envoi", async () => {
    const { rerender } = monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    mocks.submit.mockClear();

    rerender({ enabled: true, open: true, selected: [], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    rerender({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("un changement de sélection prévient les autres onglets ; un renouvellement, non", async () => {
    monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(mocks.notify).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    expect(mocks.submit).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it("page masquée : plus de renouvellement ; au retour, la sélection repart une fois", async () => {
    monter({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    mocks.submit.mockClear();

    await visibilite("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    });
    expect(mocks.submit).not.toHaveBeenCalled();

    await visibilite("visible");
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(mocks.submit).toHaveBeenCalledWith("pledgeSelection", expect.objectContaining({ selection: [expect.objectContaining({ finkey: "a-a" })] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    expect(mocks.submit).toHaveBeenCalledTimes(2);
  });

  it("cocher puis changer d'onglet : la sélection part quand même", async () => {
    const { rerender } = monter({ enabled: true, open: true, selected: [], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    mocks.submit.mockClear();

    rerender({ enabled: true, open: true, selected: [A], onRefused: vi.fn() });
    await visibilite("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(mocks.submit).toHaveBeenCalledWith("pledgeSelection", expect.objectContaining({ selection: [expect.objectContaining({ finkey: "a-a" })] }));
  });

  it("clé du site désactivée : aucun envoi", async () => {
    const { unmount } = monter({ enabled: false, open: true, selected: [A], onRefused: vi.fn() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });
    unmount();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
