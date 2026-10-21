// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Comment } from "@communecter/cocolight-api-client";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import "../i18n";

/**
 * La modale des votants dit ce qu'elle montre (revue du 16/10) : elle s'intitulait « Ajouter une
 * réaction », chargeait « la discussion » et annonçait « Aucun message » — un échec compris.
 *
 * Seule la requête est simulée : c'est une frontière réseau, la modale est la pièce jugée.
 */

const requete = vi.hoisted(() => ({
  etat: { voters: [] as unknown[], data: undefined as unknown, isLoading: false, isError: false, isFetching: false },
  refetch: vi.fn(),
}));
vi.mock("../hooks/useCommentVoters", () => ({
  useCommentVoters: () => ({ ...requete.etat, refetch: requete.refetch }),
}));

const { VotersDialog } = await import("./VotersDialog");

const INSTANCE = {} as Comment;

function monter(instance: Comment | null = INSTANCE) {
  return render(createElement(LocalizationProvider, null,
    createElement(VotersDialog, { commentId: "c".repeat(24), instance, onOpenChange: () => {} })));
}

beforeEach(() => {
  requete.etat = { voters: [], data: undefined, isLoading: false, isError: false, isFetching: false };
  requete.refetch.mockClear();
});

describe("VotersDialog — ses propres libellés", () => {
  it("s'intitule « Qui a réagi », et se décrit", () => {
    monter();
    const dialogue = screen.getByRole("dialog");
    expect(screen.getByRole("heading", { name: "Qui a réagi" })).toBeTruthy();
    expect(dialogue.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(dialogue.getAttribute("aria-describedby")!)?.textContent)
      .toContain("réagi à ce message");
  });

  it("charge « les réactions », pas « la discussion »", () => {
    requete.etat = { ...requete.etat, isLoading: true };
    monter();
    expect(screen.getByText("Chargement des réactions…")).toBeTruthy();
  });

  it("sans votant : « Aucune réaction », pas « Aucun message »", () => {
    monter();
    expect(screen.getByText("Aucune réaction pour l'instant")).toBeTruthy();
    expect(screen.queryByText(/Aucun message/)).toBeNull();
  });

  it("un échec sans liste se dit comme tel, avec de quoi réessayer", () => {
    requete.etat = { ...requete.etat, isError: true };
    monter();
    expect(screen.getByText("Les réactions n'ont pas pu être chargées.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(requete.refetch).toHaveBeenCalledTimes(1);
  });

  it("une relecture ratée GARDE la liste servie — comme le panneau et le fil", () => {
    const camille = { id: "e".repeat(24), name: "Camille", slug: null, avatarUrl: null, reaction: "like", at: 0 };
    requete.etat = { ...requete.etat, voters: [camille], data: { voters: [camille], counts: { like: 1 } }, isError: true };
    monter();
    expect(screen.getByText("Camille")).toBeTruthy();
    expect(screen.queryByText("Les réactions n'ont pas pu être chargées.")).toBeNull();
  });

  it("sans instance du message, rien ne viendra : c'est un échec, sans bouton qui ne ferait rien", () => {
    monter(null);
    expect(screen.getByText("Les réactions n'ont pas pu être chargées.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
  });

  it("sa largeur tient au-delà de 640 px : `sm:max-w-sm`, pas un `max-w-sm` que la base écrase", () => {
    monter();
    expect(screen.getByRole("dialog").className).toContain("sm:max-w-sm");
  });
});
