// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let cocolight: { api: { project: ReturnType<typeof vi.fn> } | null; me: null };
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => cocolight }));

const { useCommunProjectEntityQuery } = await import("./useCommunProjectEntity");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  cocolight = { api: { project: vi.fn(async () => ({ id: "p1" })) }, me: null };
});

describe("useCommunProjectEntityQuery — « pas encore partie » n'est pas « non résolue »", () => {
  it("client pas prêt (requête désactivée) : pas de projet, et pas « non résolu »", () => {
    cocolight = { api: null, me: null };
    const { result } = renderHook(() => useCommunProjectEntityQuery("p1"), { wrapper });

    expect(result.current).toEqual({ project: null, isUnresolved: false });
  });

  it("projet introuvable ou en échec : non résolu", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    cocolight.api!.project.mockRejectedValue(new Error("404"));
    const { result } = renderHook(() => useCommunProjectEntityQuery("p1"), { wrapper });

    await waitFor(() => expect(result.current.isUnresolved).toBe(true));
    expect(result.current.project).toBeNull();
  });

  it("projet résolu : jamais « non résolu »", async () => {
    const { result } = renderHook(() => useCommunProjectEntityQuery("p1"), { wrapper });

    await waitFor(() => expect(result.current.project).toEqual({ id: "p1" }));
    expect(result.current.isUnresolved).toBe(false);
  });
});
