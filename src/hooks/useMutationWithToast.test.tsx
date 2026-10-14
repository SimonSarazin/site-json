// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `silentSuccess` tait le toast de SUCCÈS — pour un appelant qui affiche le sien — et RIEN d'autre :
 * ni le toast d'erreur (un échec doit rester visible), ni le rappel et l'invalidation (la modale
 * « Rejoindre un lieu » compte sur eux pour rafraîchir sa section « En attente »).
 */

const toastUtils = vi.hoisted(() => ({ showSuccessToast: vi.fn(), showErrorToast: vi.fn() }));
vi.mock("@/lib/toastUtils", () => toastUtils);
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));

const { useMutationWithToast } = await import("./useMutationWithToast");

function monter(
  mutationFn: () => Promise<void>,
  silentSuccess?: boolean,
  extra: { onSuccessCallback?: () => void; invalidateQueries?: string[][] } = {}
) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const invalider = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHook(
    () => useMutationWithToast({ mutationFn, successKey: "ok", errorKey: "ko", silentSuccess, ...extra }),
    { wrapper }
  );
  return { result, invalider };
}

beforeEach(() => {
  toastUtils.showSuccessToast.mockReset();
  toastUtils.showErrorToast.mockReset();
});

describe("useMutationWithToast — silentSuccess", () => {
  it("par défaut, le succès s'annonce", async () => {
    const { result } = monter(async () => {});
    await act(() => result.current.mutateAsync());
    expect(toastUtils.showSuccessToast).toHaveBeenCalledWith("ok", expect.any(Function), undefined);
  });

  it("avec silentSuccess, le succès se tait", async () => {
    const { result } = monter(async () => {}, true);
    await act(() => result.current.mutateAsync());
    expect(toastUtils.showSuccessToast).not.toHaveBeenCalled();
  });

  it("avec silentSuccess, l'erreur reste signalée", async () => {
    const { result } = monter(async () => {
      throw new Error("refusé");
    }, true);
    await act(() => result.current.mutateAsync().catch(() => {}));
    expect(toastUtils.showErrorToast).toHaveBeenCalledWith(expect.any(Error), "ko", expect.any(Function), undefined);
    expect(toastUtils.showSuccessToast).not.toHaveBeenCalled();
  });

  it("avec silentSuccess, le rappel et l'invalidation s'exécutent quand même", async () => {
    const onSuccessCallback = vi.fn();
    const { result, invalider } = monter(async () => {}, true, { onSuccessCallback, invalidateQueries: [["cle"]] });
    await act(() => result.current.mutateAsync());
    expect(toastUtils.showSuccessToast).not.toHaveBeenCalled();
    expect(onSuccessCallback).toHaveBeenCalledTimes(1);
    expect(invalider).toHaveBeenCalledWith({ queryKey: ["cle"] });
  });
});
