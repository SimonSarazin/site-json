// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import type { CommentTarget } from "../types";

/**
 * Le marquage « lu » d'un fil.
 *
 * Ce qui est en jeu n'est pas l'appel lui-même mais ce qu'il laisse À L'ÉCRAN : le point
 * « nouveau » et le fond de mention doivent rester pendant la lecture, et avoir disparu à la
 * visite suivante. D'où les deux invalidations, et leur différence : le panneau est relu, le fil
 * est seulement déclaré périmé.
 *
 * Seule la session est simulée — c'est la frontière réseau. Le cache, lui, est un vrai
 * `QueryClient`, observé.
 */

const session = vi.hoisted(() => ({ connecte: true, markCommentsSeen: vi.fn() }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    api: { markCommentsSeen: session.markCommentsSeen },
    me: { isConnected: session.connecte },
  }),
}));

const { useMarkThreadSeen } = await import("./useMarkThreadSeen");

const CIBLE: CommentTarget = { type: "news", id: "6".repeat(24), path: null };

function monter(ids: readonly string[]) {
  const client = new QueryClient();
  const invalider = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const rendu = renderHook(({ ids: liste }: { ids: readonly string[] }) => useMarkThreadSeen(CIBLE, liste), {
    wrapper, initialProps: { ids },
  });
  return { ...rendu, invalider };
}

/** Laisse filer les promesses en cours, sans rien attendre de précis. */
const laisserFiler = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  session.connecte = true;
  session.markCommentsSeen.mockReset();
  session.markCommentsSeen.mockResolvedValue({ result: true, marked: 2 });
});

describe("useMarkThreadSeen", () => {
  it("n'écrit rien quand le fil n'a aucun non-lu", async () => {
    monter([]);
    await laisserFiler();
    expect(session.markCommentsSeen).not.toHaveBeenCalled();
  });

  it("n'écrit rien pour un visiteur anonyme", async () => {
    session.connecte = false;
    monter(["a", "b", "c"]);
    await laisserFiler();
    expect(session.markCommentsSeen).not.toHaveBeenCalled();
  });

  it("marque le fil, relit le panneau, et déclare le fil PÉRIMÉ sans le relire", async () => {
    const { invalider } = monter(["a", "b"]);
    await waitFor(() => expect(invalider).toHaveBeenCalledTimes(2));
    expect(session.markCommentsSeen).toHaveBeenCalledWith({ contextType: "news", contextId: CIBLE.id, ids: ["a", "b"] });
    expect(invalider).toHaveBeenCalledWith({
      queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX(), refetchType: "active",
    });
    // Relu tout de suite, le fil effacerait sous les yeux le « nouveau » et le fond de mention.
    expect(invalider).toHaveBeenCalledWith({
      queryKey: COMMENT_QUERY_KEYS.THREAD_PREFIX(CIBLE), refetchType: "none",
    });
  });

  it("n'invalide rien quand le serveur n'a rien marqué", async () => {
    session.markCommentsSeen.mockResolvedValue({ result: true, marked: 0 });
    const { invalider } = monter(["a", "b"]);
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(1));
    await laisserFiler();
    expect(invalider).not.toHaveBeenCalled();
  });

  it("ne remarque pas les MÊMES messages pendant la visite", async () => {
    const { rerender } = monter(["a", "b"]);
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(1));
    rerender({ ids: ["a", "b"] });
    await laisserFiler();
    expect(session.markCommentsSeen).toHaveBeenCalledTimes(1);
  });

  it("remarque quand un NOUVEAU message non lu arrive pendant la visite (A10, revue du 29/09)", async () => {
    const { rerender } = monter(["a", "b"]);
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(1));
    rerender({ ids: ["c"] });
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(2));
  });

  /**
   * Le fil se démonte à chaque changement de fil. Si la réponse du serveur arrive après, le
   * panneau doit quand même éteindre la pastille du fil qu'on vient de quitter.
   */
  it("invalide même si le fil s'est fermé avant la réponse du serveur", async () => {
    let repondre: (valeur: unknown) => void = () => {};
    session.markCommentsSeen.mockReturnValue(new Promise(resolve => { repondre = resolve; }));
    const { unmount, invalider } = monter(["a", "b"]);
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(1));
    unmount();
    repondre({ result: true, marked: 1 });
    await waitFor(() => expect(invalider).toHaveBeenCalledTimes(2));
  });

  it("un marquage perdu se retente à la prochaine ouverture", async () => {
    session.markCommentsSeen.mockRejectedValueOnce(new Error("réseau"));
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = monter(["a", "b"]);
    await waitFor(() => expect(avertir).toHaveBeenCalled());
    rerender({ ids: ["a", "b", "c"] });
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(2));
    avertir.mockRestore();
  });
});

/**
 * Le marquage ne vise que ce qui a été AFFICHÉ (revue du 16/10, R6) : sans identifiants, le serveur
 * marquait tout le fil — un message arrivé depuis le chargement passait « lu » sans avoir été vu —,
 * et un non-lu arrivé pendant un marquage en vol n'était jamais repris.
 */
describe("useMarkThreadSeen — les messages affichés, et eux seuls", () => {
  it("n'envoie que les non-lus pas encore marqués de la visite", async () => {
    const { rerender } = monter(["a", "b"]);
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(1));
    rerender({ ids: ["a", "b", "c"] });
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(2));
    expect(session.markCommentsSeen.mock.calls[1]![0]).toMatchObject({ ids: ["c"] });
  });

  it("un non-lu arrivé PENDANT un marquage en vol est marqué à l'atterrissage", async () => {
    let repondre: (valeur: unknown) => void = () => {};
    session.markCommentsSeen.mockReturnValueOnce(new Promise(resolve => { repondre = resolve; }));
    const { rerender } = monter(["a"]);
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(1));

    rerender({ ids: ["a", "b"] });
    await laisserFiler();
    // En vol : on n'en lance pas un second…
    expect(session.markCommentsSeen).toHaveBeenCalledTimes(1);

    repondre({ result: true, marked: 1 });
    // … mais l'atterrissage reprend ce qui est arrivé entre-temps.
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(2));
    expect(session.markCommentsSeen.mock.calls[1]![0]).toMatchObject({ ids: ["b"] });
  });

  it("au-delà de 500 identifiants, le reste part à l'appel suivant — le plafond du serveur", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `m${i}`);
    monter(ids);
    await waitFor(() => expect(session.markCommentsSeen).toHaveBeenCalledTimes(2));
    expect((session.markCommentsSeen.mock.calls[0]![0] as { ids: string[] }).ids).toHaveLength(500);
    expect((session.markCommentsSeen.mock.calls[1]![0] as { ids: string[] }).ids).toEqual(["m500"]);
  });

  it("un marquage en échec ne relance rien, même au-delà de 500 : pas de boucle d'appels", async () => {
    session.markCommentsSeen.mockRejectedValue(new Error("réseau"));
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => {});
    monter(Array.from({ length: 600 }, (_, i) => `m${i}`));
    await waitFor(() => expect(avertir).toHaveBeenCalled());
    // Le temps de plusieurs tours : chaque échec relançait aussitôt les mêmes 500 premiers messages.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(session.markCommentsSeen).toHaveBeenCalledTimes(1);
    avertir.mockRestore();
  });
});
