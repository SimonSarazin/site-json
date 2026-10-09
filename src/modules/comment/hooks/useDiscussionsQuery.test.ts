// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import cocolightApiClient from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { errorCodeOf } from "../lib/discussions";
import {
  intervalleDeSondage, useDiscussionsQuery, type DiscussionScope, type UseDiscussionsQueryOptions,
} from "./useDiscussionsQuery";

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

  const RAIL: DiscussionScope = { kind: "rail" };
  const UTILISATEUR = "65d4000000000000000000d1";
  const RAIL_SERVI = { result: true, depth: "rail", carriers: [] };

  /** `utilisateur` : qui est connecté au montage — personne par défaut. */
  function monter(
    reponse: () => Promise<unknown>,
    scope: DiscussionScope = RAIL,
    utilisateur: string | null = null,
    options?: UseDiscussionsQueryOptions,
  ) {
    const getDiscussions = vi.fn(reponse);
    const entity = utilisateur ? { userContext: { id: utilisateur } } : null;
    const cocolight = { api: { getDiscussions }, me: null, entity, helper: {} } as unknown as CocolightContextType;
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client },
        createElement(CocolightContext.Provider, { value: cocolight }, children));
    // Chaque rendu, dans l'ordre : le premier est celui d'avant les effets.
    const rendus: { isLoading: boolean; fetchStatus: string }[] = [];
    const rendu = renderHook(() => {
      const requete = useDiscussionsQuery(scope, options);
      rendus.push({ isLoading: requete.isLoading, fetchStatus: requete.fetchStatus });
      return requete;
    }, { wrapper });
    return { getDiscussions, client, rendus, ...rendu };
  }

  // Les deux refus tels que la façade du SDK les REND : des exceptions, jamais un corps
  // `{result:false}` en valeur de retour (mesuré contre le SDK réel le 09/10).
  it("sans session, le SDK refuse lui-même : un refus `login`, jamais réessayé ni relu", async () => {
    const { getDiscussions, result } = monter(async () => {
      throw new cocolightApiClient.error.ApiAuthenticationError("Vous devez être connecté pour effectuer cette action.", 401);
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.isError).toBe(true);
    expect(errorCodeOf(result.current.error)).toBe("login");
    await vi.advanceTimersByTimeAsync(95_000);
    expect(getDiscussions).toHaveBeenCalledTimes(1);
  });

  it("un refus du serveur garde son code à travers l'exception du SDK, et n'est ni réessayé ni relu", async () => {
    const corps = { result: false, code: "hidden", msg: "Discussion introuvable, ou réservée aux membres de son espace." };
    const cible = { type: "news", id: "65b2000000000000000000b2", path: null } as const;
    const { getDiscussions, result } = monter(
      async () => { throw new cocolightApiClient.error.ApiResponseError(corps.msg, 200, corps); },
      { kind: "thread", target: cible },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.isError).toBe(true);
    expect(errorCodeOf(result.current.error)).toBe("hidden");
    await vi.advanceTimersByTimeAsync(95_000);
    expect(getDiscussions).toHaveBeenCalledTimes(1);
  });

  it("une panne, elle, est réessayée deux fois avant d'être dite", async () => {
    const { getDiscussions, result } = monter(async () => { throw new Error("Network Error"); });
    await vi.advanceTimersByTimeAsync(0);
    // Les délais de React Query entre deux tentatives : 1 s, puis 2 s.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(getDiscussions).toHaveBeenCalledTimes(3);
    expect(errorCodeOf(result.current.error)).toBe("failed");
  });

  it("relit une réponse servie au rythme du mode dégradé", async () => {
    const { getDiscussions } = monter(async () => RAIL_SERVI);
    await vi.advanceTimersByTimeAsync(0);
    expect(getDiscussions).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(getDiscussions).toHaveBeenCalledTimes(2);
  });

  /**
   * `useHydratedUserContextId` rend `null` au premier rendu de chaque montage, puis qui est
   * connecté. Partie dès ce premier rendu, la requête était faite deux fois — la première rangée
   * sous une clé qui n'est celle de personne.
   */
  it("connecté, ne demande le rail qu'UNE fois, et le range sous SA clé", async () => {
    const { getDiscussions, client } = monter(async () => RAIL_SERVI, RAIL, UTILISATEUR);
    await vi.advanceTimersByTimeAsync(0);
    expect(getDiscussions).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(COMMENT_QUERY_KEYS.DISCUSSIONS("rail", null, UTILISATEUR))).toBeDefined();
    expect(client.getQueryData(COMMENT_QUERY_KEYS.DISCUSSIONS("rail", null, null))).toBeUndefined();
  });

  it("au premier rendu, CHARGE sans rien avoir demandé — le panneau n'a pas à se dire vide entre-temps", async () => {
    const { rendus, getDiscussions } = monter(() => new Promise(() => {}), RAIL, UTILISATEUR);
    expect(rendus[0]).toEqual({ isLoading: true, fetchStatus: "idle" });
    await vi.advanceTimersByTimeAsync(0);
    expect(rendus[rendus.length - 1]).toEqual({ isLoading: true, fetchStatus: "fetching" });
    expect(getDiscussions).toHaveBeenCalledTimes(1);
  });

  it("désactivé, n'attend rien : ni chargement ni demande, même au premier rendu", async () => {
    // Une colonne sans périmètre désactive sa requête : elle ne doit pas rester en squelette.
    const { rendus, getDiscussions } = monter(async () => RAIL_SERVI, RAIL, UTILISATEUR, { enabled: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(rendus.every(rendu => !rendu.isLoading && rendu.fetchStatus === "idle")).toBe(true);
    expect(getDiscussions).not.toHaveBeenCalled();
  });
});
