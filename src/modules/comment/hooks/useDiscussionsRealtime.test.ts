// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Le temps réel du panneau, revu le 16/10 (registre `comment-dev` : R1, R2, R5).
 *
 * Le flux de l'onglet est une frontière — simulée : on y lit les rappels que le hook y abonne, et
 * l'on décide de son état. L'amortisseur, lui, est la pièce jugée.
 */

const flux = vi.hoisted(() => ({
  etat: "connecte" as string,
  sujets: new Set<(topic: string) => void>(),
  resyncs: new Set<(motif: string) => void>(),
  cache: false,
}));
vi.mock("@/hooks/useRealtimeSubscription", () => ({
  useRealtimeTopic: (_topic: string, rappel: (topic: string) => void, actif = true) => {
    if (actif) flux.sujets.add(rappel);
  },
  useRealtimeResync: (rappel: (motif: string) => void, actif = true) => {
    if (actif) flux.resyncs.add(rappel);
  },
  useRealtimeEtat: () => flux.etat,
}));
vi.mock("@/hooks/useReducedMotion", () => ({ useDocumentHidden: () => flux.cache }));

const { useDiscussionsRealtime, TOPIC_COMMENTS } = await import("./useDiscussionsRealtime");

/** Les invalidations du panneau, comptées. */
function monter(abonnes = 1) {
  const client = new QueryClient();
  const invalider = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  // Le panneau monte quatre `useDiscussionsQuery`, donc quatre abonnés : on les monte ensemble.
  const rendu = renderHook(() => Array.from({ length: abonnes }, () => useDiscussionsRealtime(true)), { wrapper });
  return { ...rendu, invalider };
}

/**
 * Un signal du hub : le bus le distribue à TOUS les abonnés dans le même tour, puis la tâche se
 * termine, microtâches comprises. Deux signaux sont deux messages du flux, donc deux tâches.
 */
const signal = async () => {
  act(() => { for (const rappel of [...flux.sujets]) rappel(TOPIC_COMMENTS); });
  await Promise.resolve();
};
const resync = () => act(() => { for (const rappel of [...flux.resyncs]) rappel("reprise"); });

let cacheDocument = false;
beforeEach(() => {
  vi.useFakeTimers();
  flux.etat = "connecte";
  flux.sujets.clear();
  flux.resyncs.clear();
  flux.cache = false;
  cacheDocument = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => cacheDocument });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useDiscussionsRealtime — « connecte » ne suffit pas (R1)", () => {
  it("flux ouvert mais sujet jamais reçu : l'état rendu est « degrade » — le sondage reste à 30 s", () => {
    const { result } = monter();
    expect(result.current[0]).toBe("degrade");
  });

  it("dès le premier signal reçu, le panneau se fie au temps réel", async () => {
    const { result, rerender } = monter();
    await signal();
    rerender();
    expect(result.current[0]).toBe("connecte");
  });

  it("les autres états passent tels quels", () => {
    flux.etat = "coupe";
    const { result } = monter();
    expect(result.current[0]).toBe("coupe");
  });
});

describe("useDiscussionsRealtime — un amortisseur pour tout l'onglet (R5)", () => {
  it("quatre abonnés, une resynchronisation : UN rafraîchissement", () => {
    const { invalider } = monter(4);
    resync();
    expect(invalider).toHaveBeenCalledTimes(1);
  });

  it("quatre abonnés, un signal : UN rafraîchissement — ni tout de suite, ni à la fin de la fenêtre", async () => {
    const { invalider } = monter(4);
    await signal();
    expect(invalider).toHaveBeenCalledTimes(1);
    // Les trois autres abonnés ne sont que l'écho du même signal : aucun rattrapage n'est dû.
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(invalider).toHaveBeenCalledTimes(1);
  });

  it("deux resynchronisations à plus d'une seconde d'écart : deux rafraîchissements", () => {
    const { invalider } = monter(4);
    resync();
    act(() => { vi.advanceTimersByTime(1_500); });
    resync();
    expect(invalider).toHaveBeenCalledTimes(2);
  });
});

describe("useDiscussionsRealtime — la fin de fenêtre (R2)", () => {
  it("un signal arrivé DANS la fenêtre est rattrapé à sa fin, une seule fois", async () => {
    const { invalider } = monter(2);
    await signal();
    expect(invalider).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(1_000); });
    await signal();
    await signal();
    expect(invalider).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(4_000); });
    expect(invalider).toHaveBeenCalledTimes(2);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(invalider).toHaveBeenCalledTimes(2);
  });

  it("onglet caché : rien tout de suite ; au retour, UN rattrapage pour tous les abonnés", async () => {
    cacheDocument = true;
    flux.cache = true;
    const { invalider, rerender } = monter(4);
    await signal();
    expect(invalider).not.toHaveBeenCalled();

    cacheDocument = false;
    flux.cache = false;
    rerender();
    expect(invalider).toHaveBeenCalledTimes(1);
  });
});
