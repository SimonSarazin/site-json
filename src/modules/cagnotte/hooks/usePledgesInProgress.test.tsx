// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  enabled: true,
  me: { id: "u1" } as { id: string } | null,
  listener: null as null | (() => void),
}));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelopeAction", () => ({ useFundingEnvelopeAction: () => mocks.submit }));
vi.mock("@/modules/cagnotte/hooks/usePledgeRetractionEnabled", () => ({ usePledgeRetractionEnabled: () => mocks.enabled }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: mocks.me }) }));
vi.mock("@/modules/cagnotte/utils/pledgeHolder", () => ({ getPledgeHolder: () => "onglet-test-1" }));
vi.mock("@/modules/cagnotte/utils/pledgeChanges", () => ({
  onPledgeChange: (listener: () => void) => {
    mocks.listener = listener;
    return () => {
      mocks.listener = null;
    };
  },
}));

const { usePledgesInProgress, pledgesInProgressInterval, PLEDGES_IN_PROGRESS_INTERVAL_MS, PLEDGES_IN_PROGRESS_ERROR_INTERVAL_MS } =
  await import("./usePledgesInProgress");
const { CAGNOTTE_QUERY_KEYS } = await import("@/modules/cagnotte/constants/queryKeys");

const EN_COURS = { ans1: { pledges: [{ finkey: "a-1", kind: "hold", mine: false, until: 1 }], depenses: [] } };

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
const monter = (ids: string[], opts?: Parameters<typeof usePledgesInProgress>[1]) =>
  renderHook(() => usePledgesInProgress(ids, opts), { wrapper });

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.submit.mockReset();
  mocks.submit.mockResolvedValue({ success: 1, paymentsInProgress: EN_COURS });
  mocks.enabled = true;
  mocks.me = { id: "u1" };
});
afterEach(() => {
  queryClient.clear();
  delete (document as unknown as Record<string, unknown>).visibilityState;
  delete (document as unknown as Record<string, unknown>).hidden;
  vi.useRealTimers();
});

/** Rend la page visible ou masquée, comme un changement d'onglet (l'événement remonte jusqu'à `window`). */
async function visibilite(etat: "visible" | "hidden") {
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => etat });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => etat === "hidden" });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    await Promise.resolve();
  });
}

describe("usePledgesInProgress", () => {
  it("demande les paiements en cours de ces réponses, au nom de cet onglet", async () => {
    const { result } = monter(["ans2", "ans1", "ans1", ""]);

    await waitFor(() => expect(result.current).toEqual({ paymentsInProgress: EN_COURS }));
    expect(mocks.submit).toHaveBeenCalledWith("pledgesInProgress", { answerIds: ["ans1", "ans2"], holder: "onglet-test-1" });
  });

  it("rythme : aucun minuteur page masquée, 60 s, 5 min après un échec", () => {
    expect(pledgesInProgressInterval(false, false)).toBe(false);
    expect(pledgesInProgressInterval(false, true)).toBe(false);
    expect(pledgesInProgressInterval(true, false)).toBe(PLEDGES_IN_PROGRESS_INTERVAL_MS);
    expect(pledgesInProgressInterval(true, true)).toBe(PLEDGES_IN_PROGRESS_ERROR_INTERVAL_MS);
    expect(PLEDGES_IN_PROGRESS_INTERVAL_MS).toBe(60_000);
  });

  it("page masquée : plus aucune relecture ; au retour, une relecture", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    monter(["ans1"]);
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));

    await visibilite("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * PLEDGES_IN_PROGRESS_INTERVAL_MS);
    });
    expect(mocks.submit).toHaveBeenCalledTimes(1);

    await visibilite("visible");
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
  });

  it("pas de nouvelle tentative après un échec, même avec les réglages par défaut de React Query", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    queryClient = new QueryClient();
    mocks.submit.mockRejectedValue(new Error("401"));
    monter(["ans1"]);
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLEDGES_IN_PROGRESS_INTERVAL_MS);
    });
    expect(mocks.submit).toHaveBeenCalledTimes(1);
  });

  it("un autre onglet signale un changement : relecture aussitôt, ou au retour si la page est masquée", async () => {
    monter(["ans1"]);
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));

    await act(async () => mocks.listener?.());
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));

    await visibilite("hidden");
    await act(async () => mocks.listener?.());
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.submit).toHaveBeenCalledTimes(2);

    await visibilite("visible");
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(3));
  });

  it("relit toutes les 60 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    monter(["ans1"]);
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLEDGES_IN_PROGRESS_INTERVAL_MS);
    });
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
  });

  it.each([
    ["clé du site désactivée", () => { mocks.enabled = false; }, ["ans1"], undefined],
    ["visiteur non connecté", () => { mocks.me = null; }, ["ans1"], undefined],
    ["aucune réponse", () => {}, [], undefined],
    ["désactivée par l'appelant", () => {}, ["ans1"], { enabled: false }],
  ])("%s : aucune requête", async (_label, arrange, ids, opts) => {
    arrange();
    const { result } = monter(ids as string[], opts as Parameters<typeof usePledgesInProgress>[1]);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it("subscribeOnly : lit la relecture d'un autre lecteur sans interroger le serveur", async () => {
    queryClient.setQueryData(CAGNOTTE_QUERY_KEYS.PLEDGES_IN_PROGRESS(["ans1"], "u1"), { paymentsInProgress: EN_COURS });
    const { result } = monter(["ans1"], { subscribeOnly: true });

    expect(result.current).toEqual({ paymentsInProgress: EN_COURS });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("relecture coupée par l'appelant : le cache n'est plus rendu, l'appelant lit l'enveloppe", async () => {
    queryClient.setQueryData(CAGNOTTE_QUERY_KEYS.PLEDGES_IN_PROGRESS(["ans1"], "u1"), { paymentsInProgress: EN_COURS });
    const { result } = monter(["ans1"], { enabled: false });

    expect(result.current).toBeUndefined();
  });
});
