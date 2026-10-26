// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { act, renderWithProviders, screen, userEvent } from "../../../../../../tests/test-utils-ui";

/**
 * Tests du bouton « Rejoindre la communauté » du hero.
 *
 * Les dépendances d'environnement sont mockées : ce qui est vérifié ici est
 * l'ARBITRAGE (anonyme → connexion, membre → rien à demander, demande en
 * attente) et le fait qu'un vrai appel d'adhésion parte, pas la mutation du
 * module profil ni le provider Cocolight.
 */

const openLogin = vi.fn();
const mutate = vi.fn();
let me: { id: string } | null = null;
let entity: { slug: string } | null = { slug: "ma-communaute" };
let permissions: Record<string, boolean>;

vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me, entity }) }));
vi.mock("@/modules/auth/hooks/useAuthModal", () => ({ useAuthModal: () => ({ openLogin }) }));
vi.mock("@/modules/profil/hooks/useProfilPermissions", () => ({
  useProfilPermissions: () => permissions,
}));
vi.mock("@/modules/profil/actions/mutations/relationship", () => ({
  useRequestToJoin: () => ({ mutate, isPending: false }),
}));

const { AmpliJoinButton } = await import("./AmpliJoinButton");

/** Aucun lien avec l'entité : le cas d'un visiteur ou d'un nouveau venu. */
const NO_LINK = {
  isMember: false,
  isContributor: false,
  isAdmin: false,
  isToBeValidated: false,
  canRequestMembership: true,
  canRequestContributor: false,
};

const render = () => renderWithProviders(<AmpliJoinButton />);
const button = () => screen.getByRole("button");

describe("AmpliJoinButton", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    openLogin.mockClear();
    mutate.mockClear();
    me = { id: "user-1" };
    entity = { slug: "ma-communaute" };
    permissions = { ...NO_LINK };
  });

  it("envoie une demande d'adhésion et le dit tout de suite", async () => {
    render();
    expect(button()).toHaveTextContent("Rejoindre la communauté");

    await userEvent.click(button());

    expect(mutate).toHaveBeenCalledTimes(1);
    // Les liens de l'entité ne se rafraîchissent pas dans la foulée : c'est le
    // retour local qui empêche une seconde demande.
    act(() => mutate.mock.calls[0][1].onSuccess());
    expect(button()).toHaveTextContent("Demande envoyée");
    expect(button()).toBeDisabled();
  });

  // Un projet a des CONTRIBUTEURS, pas des membres : lire la seule permission
  // `canRequestMembership` laisserait le bouton inerte sur un site porté par
  // un projet.
  it("marche aussi quand la communauté est un projet", async () => {
    permissions = { ...NO_LINK, canRequestMembership: false, canRequestContributor: true };
    render();

    await userEvent.click(button());

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("ouvre la connexion au lieu d'un appel voué à l'échec quand personne n'est connecté", async () => {
    me = null;
    render();

    await userEvent.click(button());

    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(mutate).not.toHaveBeenCalled();
  });

  describe("états sans action possible", () => {
    it("annonce l'adhésion à un membre", () => {
      permissions = { ...NO_LINK, isMember: true, canRequestMembership: false };
      render();

      expect(button()).toHaveTextContent("Vous êtes membre");
      expect(button()).toBeDisabled();
    });

    it("annonce l'adhésion à un contributeur de projet", () => {
      permissions = { ...NO_LINK, isContributor: true, canRequestMembership: false };
      render();

      expect(button()).toHaveTextContent("Vous êtes membre");
    });

    it("rappelle la demande déjà partie", () => {
      permissions = { ...NO_LINK, isToBeValidated: true, canRequestMembership: false };
      render();

      expect(button()).toHaveTextContent("Demande envoyée");
      expect(button()).toBeDisabled();
    });

    it("se désactive quand l'entité du site n'est pas résolue", () => {
      entity = null;
      render();

      expect(button()).toBeDisabled();
    });
  });
});
