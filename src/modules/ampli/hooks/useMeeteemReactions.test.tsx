// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { MeeteemCard } from "../types";

// Dépendances d'environnement mockées : ce qu'on teste ici est la BASCULE
// (ajout/retrait, prévision optimiste, arbitrage par la réponse serveur), pas
// le provider Cocolight ni le rendu des toasts.
let currentUserId: string | null = "user-1";
const openLogin = vi.fn();
const showErrorToast = vi.fn();

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me: currentUserId ? { serverData: { id: currentUserId } } : null }),
}));
vi.mock("@/modules/auth/hooks/useAuthModal", () => ({ useAuthModal: () => ({ openLogin }) }));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/lib/toastUtils", () => ({ showErrorToast: (...args: unknown[]) => showErrorToast(...args) }));

const { useMeeteemReactions, MEETEEM_REACTION_STATUS } = await import("./useMeeteemReactions");

/** Réponse du backend : `removedVoteStatus` n'est présent qu'au RETRAIT. */
const added = { inc: 1, msg: "Reaction succesfully saved" };
const removed = { inc: -1, msg: "", removedVoteStatus: MEETEEM_REACTION_STATUS };

function makeCard(
  vote: Record<string, unknown> | undefined,
  addVote?: (status: string) => Promise<{ removedVoteStatus?: string; inc?: number }>,
): MeeteemCard {
  return {
    answer: { serverData: { id: "answer-1", vote }, addVote },
    data: { name: "Une idée" },
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const render = () => renderHook(() => useMeeteemReactions(), { wrapper });

describe("useMeeteemReactions", () => {
  beforeEach(() => {
    currentUserId = "user-1";
    openLogin.mockClear();
    showErrorToast.mockClear();
  });

  describe("état dérivé des données serveur", () => {
    it("compte les réactions et détecte celle de l'utilisateur courant", () => {
      const { result } = render();
      const card = makeCard({ "user-1": { status: "like" }, "user-2": { status: "like" } });

      const state = result.current.getReaction(card, "answer-1");

      expect(state.count).toBe(2);
      expect(state.reacted).toBe(true);
    });

    it("ne se croit pas réacteur quand seuls d'AUTRES ont voté", () => {
      const { result } = render();
      const card = makeCard({ "user-2": { status: "like" } });

      const state = result.current.getReaction(card, "answer-1");

      expect(state.count).toBe(1);
      expect(state.reacted).toBe(false);
    });

    it("rend 0 sans aucune réaction", () => {
      const { result } = render();
      expect(result.current.getReaction(makeCard(undefined), "answer-1").count).toBe(0);
    });

    it("n'expose pas de bascule quand la réponse n'est pas une entité SDK", () => {
      const { result } = render();
      // Pas de `addVote` : fixture de test ou JSON non revivifié.
      expect(result.current.getReaction(makeCard({}), "answer-1").toggle).toBeUndefined();
    });
  });

  describe("ajout d'une réaction", () => {
    it("affiche +1 immédiatement puis confirme avec la réponse serveur", async () => {
      const addVote = vi.fn().mockResolvedValue(added);
      const card = makeCard({ "user-2": { status: "like" } }, addVote);
      const { result } = render();

      act(() => result.current.getReaction(card, "answer-1").toggle!());

      // Optimiste : le compte bouge avant tout aller-retour.
      expect(result.current.getReaction(card, "answer-1").count).toBe(2);
      expect(result.current.getReaction(card, "answer-1").reacted).toBe(true);
      expect(result.current.getReaction(card, "answer-1").pending).toBe(true);

      await waitFor(() => expect(result.current.getReaction(card, "answer-1").pending).toBe(false));
      expect(addVote).toHaveBeenCalledWith(MEETEEM_REACTION_STATUS);
      expect(result.current.getReaction(card, "answer-1").reacted).toBe(true);
      expect(result.current.getReaction(card, "answer-1").count).toBe(2);
    });

    it("garde le compte ancré sur le serveur (les votes des autres restent)", async () => {
      const card = makeCard(
        { "user-2": {}, "user-3": {}, "user-4": {} },
        vi.fn().mockResolvedValue(added),
      );
      const { result } = render();

      act(() => result.current.getReaction(card, "answer-1").toggle!());

      await waitFor(() => expect(result.current.getReaction(card, "answer-1").pending).toBe(false));
      expect(result.current.getReaction(card, "answer-1").count).toBe(4);
    });
  });

  describe("retrait d'une réaction", () => {
    it("affiche -1 immédiatement et n'utilise QU'UN appel (le backend bascule)", async () => {
      const addVote = vi.fn().mockResolvedValue(removed);
      const card = makeCard({ "user-1": { status: "like" }, "user-2": {} }, addVote);
      const { result } = render();

      act(() => result.current.getReaction(card, "answer-1").toggle!());

      expect(result.current.getReaction(card, "answer-1").count).toBe(1);
      expect(result.current.getReaction(card, "answer-1").reacted).toBe(false);

      await waitFor(() => expect(result.current.getReaction(card, "answer-1").pending).toBe(false));
      expect(addVote).toHaveBeenCalledTimes(1);
      expect(addVote).toHaveBeenCalledWith(MEETEEM_REACTION_STATUS);
      expect(result.current.getReaction(card, "answer-1").reacted).toBe(false);
    });

    it("suit le serveur quand il bascule dans l'autre sens que prévu", async () => {
      // Cache chargé sans la réaction (autre onglet, données antérieures) : on
      // prévoit un ajout, le backend répond un RETRAIT. C'est lui qui tranche.
      const card = makeCard({}, vi.fn().mockResolvedValue(removed));
      const { result } = render();

      act(() => result.current.getReaction(card, "answer-1").toggle!());
      expect(result.current.getReaction(card, "answer-1").reacted).toBe(true);

      await waitFor(() => expect(result.current.getReaction(card, "answer-1").reacted).toBe(false));
    });
  });

  describe("échec et connexion", () => {
    it("revient à l'état serveur et signale l'erreur", async () => {
      const card = makeCard({ "user-2": {} }, vi.fn().mockRejectedValue(new Error("boom")));
      const { result } = render();

      act(() => result.current.getReaction(card, "answer-1").toggle!());
      expect(result.current.getReaction(card, "answer-1").reacted).toBe(true);

      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
      expect(result.current.getReaction(card, "answer-1").reacted).toBe(false);
      expect(result.current.getReaction(card, "answer-1").count).toBe(1);
    });

    it("ouvre la connexion au lieu d'appeler l'API si personne n'est connecté", () => {
      currentUserId = null;
      const addVote = vi.fn();
      const card = makeCard({}, addVote);
      const { result } = render();

      act(() => result.current.getReaction(card, "answer-1").toggle!());

      expect(openLogin).toHaveBeenCalled();
      expect(addVote).not.toHaveBeenCalled();
    });

    it("ignore un second clic tant que le premier est en vol", async () => {
      const addVote = vi.fn().mockResolvedValue(added);
      const card = makeCard({}, addVote);
      const { result } = render();

      act(() => result.current.getReaction(card, "answer-1").toggle!());
      act(() => result.current.getReaction(card, "answer-1").toggle!());

      await waitFor(() => expect(result.current.getReaction(card, "answer-1").pending).toBe(false));
      expect(addVote).toHaveBeenCalledTimes(1);
    });
  });
});
