// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: null }) }));

let projetCourant: { project: { id: string; getEvents: ReturnType<typeof vi.fn> } | null; isLoading: boolean };
vi.mock("./useCommunProjectEntity", () => ({
  useCommunProjectEntityQuery: () => projetCourant,
}));

const { useCommunProjectEvents, COMMUN_EVENTS_PAGE_SIZE } = await import("./useCommunProjectEvents");

const page = (results: unknown[]) => ({ results, count: { total: results.length }, hasNext: false, hasPrev: false, pageNumber: 1, pageIndex: 0 });

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  projetCourant = { project: { id: "p1", getEvents: vi.fn(async () => page([{ id: "e1" }])) }, isLoading: false };
});

describe("useCommunProjectEvents", () => {
  it("à venir : à partir de maintenant, du plus proche au plus lointain", async () => {
    const { result } = renderHook(() => useCommunProjectEvents("p1", "upcoming"), { wrapper });

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(projetCourant.project!.getEvents).toHaveBeenCalledWith({
      indexMin: 0,
      indexStep: COMMUN_EVENTS_PAGE_SIZE,
      from: result.current.now.toISOString(),
      order: "asc",
    });
  });

  it("passés : jusqu'à maintenant, du plus récent, sans récurrents", async () => {
    const { result } = renderHook(() => useCommunProjectEvents("p1", "past"), { wrapper });

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(projetCourant.project!.getEvents).toHaveBeenCalledWith({
      indexMin: 0,
      indexStep: COMMUN_EVENTS_PAGE_SIZE,
      to: result.current.now.toISOString(),
      order: "desc",
      recurrency: false,
    });
  });

  it("projet en résolution : chargement, pas d'erreur", () => {
    projetCourant = { project: null, isLoading: true };
    const { result } = renderHook(() => useCommunProjectEvents("p1", "upcoming"), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it("projet non résolu : erreur, pas de chargement sans fin", () => {
    projetCourant = { project: null, isLoading: false };
    const { result } = renderHook(() => useCommunProjectEvents("p1", "upcoming"), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
  });
});
