// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Api } from "@communecter/cocolight-api-client";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import { COMMUN_ANSWER_QUERY_KEY } from "../prefetch/prefetchCommun";

vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k }));
vi.mock("@/lib/toastUtils", () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));

const { useDeleteCommun } = await import("./useDeleteCommun");

function setup(onDeleted?: Parameters<typeof useDeleteCommun>[0]["onDeleted"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(COMMUN_ANSWER_QUERY_KEY("a1", "u1"), { id: "a1" });
  queryClient.setQueryData(COMMUN_ANSWER_QUERY_KEY("a1", null), { id: "a1" });
  queryClient.setQueryData(COMMUN_ANSWER_QUERY_KEY("a2", "u1"), { id: "a2" });
  queryClient.setQueryData(AAC_QUERY_KEYS.COMMUN_PROJECT("p1", "u1"), { id: "p1" });
  queryClient.setQueryData(AAC_QUERY_KEYS.COMMUN_PROJECT("p2", "u1"), { id: "p2" });

  const api = { endpointApi: { deleteElement: vi.fn().mockResolvedValue({ result: true }) } } as unknown as Api;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useDeleteCommun({ api, onDeleted }), { wrapper });
  return { queryClient, result };
}

describe("useDeleteCommun — cache", () => {
  it("retire le document supprimé pour tous les lecteurs, et lui seul", async () => {
    const { queryClient, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ answerId: "a1" });
    });

    expect(queryClient.getQueryData(COMMUN_ANSWER_QUERY_KEY("a1", "u1"))).toBeUndefined();
    expect(queryClient.getQueryData(COMMUN_ANSWER_QUERY_KEY("a1", null))).toBeUndefined();
    expect(queryClient.getQueryData(COMMUN_ANSWER_QUERY_KEY("a2", "u1"))).toEqual({ id: "a2" });
  });

  it("retire le projet supprimé par la cascade, sans toucher aux autres", async () => {
    const { queryClient, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ answerId: "a1", withProject: true, projectId: "p1" });
    });

    expect(queryClient.getQueryData(AAC_QUERY_KEYS.COMMUN_PROJECT("p1", "u1"))).toBeUndefined();
    expect(queryClient.getQueryData(AAC_QUERY_KEYS.COMMUN_PROJECT("p2", "u1"))).toEqual({ id: "p2" });
  });

  it("appelle `onDeleted` après le retrait et avant les invalidations", async () => {
    let invalidationsAvant = -1;
    let documentAvant: unknown = "non lu";
    let queryClientRef: QueryClient | null = null;
    const onDeleted = vi.fn(() => {
      invalidationsAvant = invalidate.mock.calls.length;
      documentAvant = queryClientRef?.getQueryData(COMMUN_ANSWER_QUERY_KEY("a1", "u1"));
    });
    const { queryClient, result } = setup(onDeleted);
    queryClientRef = queryClient;
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync({ answerId: "a1" });
    });

    expect(onDeleted).toHaveBeenCalledOnce();
    expect(documentAvant).toBeUndefined();
    expect(invalidationsAvant).toBe(0);
    expect(invalidate).toHaveBeenCalled();
  });
});
