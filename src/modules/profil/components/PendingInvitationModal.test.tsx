// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";

/**
 * Destination après une réponse dans la modale d'invitation : la fiche rejointe si on accepte,
 * l'accueil si on refuse.
 *
 * Ce qui est protégé : la modale s'ouvre par-dessus TOUTE page, y compris celle du
 * lien Accepter/Refuser du mail (`AcceptInvitationPage`), dont elle masque le bouton.
 * Sans la redirection, l'invité restait sur une page qui lui proposait encore de
 * répondre à une invitation déjà tranchée.
 */

const state = vi.hoisted(() => ({
  // La mutation réussit (onSuccess appelé) ou échoue (rien n'est appelé).
  succes: true,
  setOpen: vi.fn(),
}));

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("../hooks/usePendingSiteInvitation", () => ({
  usePendingSiteInvitation: () => ({
    open: true,
    setOpen: state.setOpen,
    entity: { slug: "le-tiers-lieu", serverData: { name: "Le Tiers-lieu" } },
    entityType: "project",
    isInvitingAdmin: false,
  }),
}));
vi.mock("../actions/mutations/relationship", () => {
  const mutation = () => ({
    isPending: false,
    mutate: (_: unknown, opts?: { onSuccess?: () => void }) => {
      if (state.succes) opts?.onSuccess?.();
    },
  });
  return { useAcceptInvitation: mutation, useRejectInvitation: mutation };
});

import PendingInvitationModal from "./PendingInvitationModal";

const LIEN_MAIL =
  "/co2/link/validateinvitationbymail/userId/u1/targetType/projects/targetId/p1/costumSlug/s/costum/true/answer/true";

function Chemin() {
  return <div data-testid="chemin">{useLocation().pathname}</div>;
}

function rendre(depuis: string) {
  render(
    <MemoryRouter initialEntries={[depuis]}>
      <PendingInvitationModal />
      <Chemin />
    </MemoryRouter>,
  );
}

describe("PendingInvitationModal — destination après réponse", () => {
  beforeEach(() => {
    state.succes = true;
    state.setOpen.mockClear();
  });

  it("Accepter depuis le lien du mail : ferme la modale et mène à la fiche rejointe", () => {
    rendre(LIEN_MAIL);
    fireEvent.click(screen.getByText("PendingInvitationModal.accept"));
    expect(state.setOpen).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("chemin")).toHaveTextContent(/^\/profil\/le-tiers-lieu$/);
  });

  it("Refuser depuis n'importe quelle page : renvoie à l'accueil", () => {
    rendre("/profil/le-tiers-lieu");
    fireEvent.click(screen.getByText("PendingInvitationModal.decline"));
    expect(state.setOpen).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("chemin")).toHaveTextContent(/^\/$/);
  });

  it("mutation en échec : la modale reste ouverte et on ne quitte pas la page", () => {
    state.succes = false;
    rendre(LIEN_MAIL);
    fireEvent.click(screen.getByText("PendingInvitationModal.accept"));
    expect(state.setOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId("chemin")).toHaveTextContent(LIEN_MAIL);
  });
});
