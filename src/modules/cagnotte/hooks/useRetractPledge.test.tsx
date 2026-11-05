// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  deleteFinancer: vi.fn(),
  answer: vi.fn(),
  toastError: vi.fn(),
  showSuccessToast: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ api: { answer: mocks.answer } }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/lib/toastUtils", () => ({ showSuccessToast: mocks.showSuccessToast }));
vi.mock("@/modules/cagnotte/utils/pledgeChanges", () => ({ notifyPledgeChange: mocks.notify }));

const { useRetractPledge } = await import("./useRetractPledge");

const CIBLE = { answerId: "ans1", depenseKey: "3", financerId: "u1", finkey: "a-1" };

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  vi.clearAllMocks();
  mocks.answer.mockResolvedValue({ deleteFinancer: mocks.deleteFinancer });
  mocks.deleteFinancer.mockResolvedValue({ depenseKey: "3", remaining: 0 });
});

describe("useRetractPledge", () => {
  it("vise la ligne par sa finkey et la clé de sa dépense, jamais par sa position", async () => {
    const onRetracted = vi.fn();
    const { result } = renderHook(() => useRetractPledge({ onRetracted }), { wrapper });

    let done = false;
    await act(async () => {
      done = await result.current.retract(CIBLE);
    });

    expect(done).toBe(true);
    expect(mocks.answer).toHaveBeenCalledWith({ id: "ans1" });
    expect(mocks.deleteFinancer).toHaveBeenCalledWith({ depenseKey: "3", financerId: "u1", finkey: "a-1" });
    expect(onRetracted).toHaveBeenCalledWith(CIBLE);
    expect(mocks.showSuccessToast).toHaveBeenCalledWith("PledgeRetract.toasts.success", expect.any(Function));
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it("relit les caches du financement et ceux de l'hôte", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRetractPledge({ extraInvalidate: [["aac-commun-detail", "ans1"]] }), { wrapper });

    await act(async () => {
      await result.current.retract(CIBLE);
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ["funding-envelope"],
        ["organization-projects-with-answers"],
        ["projectModalCagnotte"],
        ["aac-milestone-list-depenses", "ans1"],
        ["aac-commun-detail", "ans1"],
      ]),
    );
  });

  it("un refus du serveur (paiement en cours) est traduit, et les caches sont relus quand même", async () => {
    mocks.deleteFinancer.mockRejectedValue(Object.assign(new Error("not allowed: already carries"), { name: "ApiError", status: 409 }));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const onRetracted = vi.fn();
    const { result } = renderHook(() => useRetractPledge({ onRetracted }), { wrapper });

    let done = true;
    await act(async () => {
      done = await result.current.retract(CIBLE);
    });

    expect(done).toBe(false);
    expect(onRetracted).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("PledgeRetract.toasts.errorTitle", {
      description: "PledgeRetract.errors.hasPayment",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["funding-envelope"] });
  });

  it("double clic : un seul appel au serveur pour la même promesse", async () => {
    let release: () => void = () => {};
    mocks.deleteFinancer.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    const { result } = renderHook(() => useRetractPledge(), { wrapper });

    let second = true;
    await act(async () => {
      const first = result.current.retract(CIBLE);
      second = await result.current.retract(CIBLE);
      await Promise.resolve();
      release();
      await first;
    });

    expect(second).toBe(false);
    expect(mocks.deleteFinancer).toHaveBeenCalledTimes(1);
  });
});
