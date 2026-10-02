// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { intervalleDeSondage, useDiscussionsQuery } from "./useDiscussionsQuery";

// Le flux temps réel est une frontière : sans hub, il est « dégradé » — le cas de tout déploiement
// sans temps réel, où l'intervalle court s'applique.
vi.mock("./useDiscussionsRealtime", () => ({ useDiscussionsRealtime: () => "degrade" }));

describe("intervalleDeSondage", () => {
  it("ne relit JAMAIS une requête refusée — elle partait toutes les 30 s (revue du 29/09)", () => {
    const refus = Object.assign(new Error("login"), { refus: true, code: "login" });
    expect(intervalleDeSondage(refus, "degrade")).toBe(false);
    expect(intervalleDeSondage(refus, "connecte")).toBe(false);
  });

  it("relit vite sans temps réel, lentement avec, et après un simple échec réseau", () => {
    expect(intervalleDeSondage(null, "degrade")).toBe(30_000);
    expect(intervalleDeSondage(null, "connecte")).toBe(300_000);
    expect(intervalleDeSondage(new Error("Network Error"), "degrade")).toBe(30_000);
  });
});

/**
 * Le CÂBLAGE de l'intervalle : la fonction pure ne prouve rien si le hook ne la consulte pas.
 * L'appel au serveur est la frontière ; React Query et le hook, eux, sont les vrais.
 */
describe("useDiscussionsQuery — le sondage, câblé", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function monter(reponse: () => Promise<unknown>) {
    const getDiscussions = vi.fn(reponse);
    const cocolight = { api: { getDiscussions }, me: null, entity: null, helper: {} } as unknown as CocolightContextType;
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client },
        createElement(CocolightContext.Provider, { value: cocolight }, children));
    const rendu = renderHook(() => useDiscussionsQuery({ kind: "rail" }), { wrapper });
    return { getDiscussions, ...rendu };
  }

  it("ne relit jamais un REFUS, même après trois intervalles", async () => {
    const { getDiscussions, result } = monter(async () => ({ result: false, code: "login" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.isError).toBe(true);
    await vi.advanceTimersByTimeAsync(95_000);
    expect(getDiscussions).toHaveBeenCalledTimes(1);
  });

  it("relit une réponse servie au rythme du mode dégradé", async () => {
    const { getDiscussions } = monter(async () => ({ result: true, depth: "rail", carriers: [] }));
    await vi.advanceTimersByTimeAsync(0);
    expect(getDiscussions).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(getDiscussions).toHaveBeenCalledTimes(2);
  });
});
