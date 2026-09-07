// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

/**
 * Ce que cette section décide, et que trois tours de travail ont empilé :
 *  1. QUI porte le badge « Déposant·e » — l'id de la fiche, pas le visiteur ;
 *  2. les rôles déclarés du projet s'affichent quand il y en a, et ne laissent
 *     aucune trace quand il n'y en a pas ;
 *  3. QUI voit le bouton d'ajout — l'admin du projet ET le déposant, personne
 *     d'autre (cf. `canInviteContributors`) ;
 *  4. QUI déclenche la lecture des invitations en attente — le seul admin du
 *     projet, parce que le backend réserve cette route (branche `isMe` du SDK).
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

vi.mock("react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

const invalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }) }));

// La modale d'invitation a ses propres dépendances (recherche de personnes,
// mutations) hors du périmètre de CE composant : on vérifie qu'elle est montée
// avec la bonne entité, pas son rendu interne.
vi.mock("@/modules/profil/components/members/InviteMemberDialog", () => ({
  InviteMemberDialog: (props: { entity: { id?: string } | null; open: boolean }) => (
    <div data-testid="invite-dialog" data-entity-id={props.entity?.id ?? ""} data-open={String(props.open)} />
  ),
}));

let listeCourante: {
  contributors: unknown[];
  total: number;
  links: Record<string, unknown>;
  isLoading: boolean;
  isError: boolean;
};
vi.mock("@/modules/aac/hooks/useCommunProjectContributors", () => ({
  useCommunProjectContributors: () => listeCourante,
}));

let projetCourant: { id: string; isAdmin: () => boolean } | null = null;
vi.mock("@/modules/aac/hooks/useCommunProjectEntity", () => ({
  useCommunProjectEntity: () => projetCourant,
}));

const useProjectContributors = vi.fn(() => ({ contributors: [] as unknown[] }));
vi.mock("@/modules/profil/hooks/useMembersQuery", () => ({
  useProjectContributors: (...args: unknown[]) => useProjectContributors(...(args as [])),
}));

const { CommunContributorsSection } = await import("./CommunContributorsSection");

type Props = Parameters<typeof CommunContributorsSection>[0];

function contributeur(over: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Alice",
    slug: "alice",
    type: "citoyens",
    isAdmin: false,
    roles: [] as string[],
    ...over,
  };
}

function renderSection(over: Partial<Props> = {}) {
  return render(<CommunContributorsSection projectId="proj-1" projectSlug="mon-projet" {...over} />);
}

/** Le libellé « Déposant·e » tel que le mock de `useT` le rend : la clé brute. */
const BADGE_DEPOSANT = "detail.contributorsSection.author";

beforeEach(() => {
  invalidateQueries.mockClear();
  useProjectContributors.mockClear();
  useProjectContributors.mockReturnValue({ contributors: [] });
  projetCourant = null;
  listeCourante = {
    contributors: [contributeur(), contributeur({ id: "u2", name: "Bob", slug: "bob" })],
    total: 2,
    links: {},
    isLoading: false,
    isError: false,
  };
});

describe("CommunContributorsSection — badge du déposant", () => {
  it("marque la fiche du déposant, et elle seule", () => {
    renderSection({ authorId: "u1" });

    expect(screen.getAllByText(BADGE_DEPOSANT)).toHaveLength(1);
    // Le badge est bien voisin du nom d'Alice, pas de celui de Bob.
    expect(within(screen.getByText("Alice").parentElement!).getByText(BADGE_DEPOSANT)).toBeTruthy();
  });

  it("ne marque personne quand le déposant n'est pas de l'équipe du projet", () => {
    // Cas réel : projet généré par l'admin de l'appel sans rattacher le déposant.
    renderSection({ authorId: "u-absent" });
    expect(screen.queryByText(BADGE_DEPOSANT)).toBeNull();
  });

  it("ne marque personne sans id de déposant", () => {
    renderSection();
    expect(screen.queryByText(BADGE_DEPOSANT)).toBeNull();
  });
});

describe("CommunContributorsSection — rôles déclarés", () => {
  it("affiche les rôles du projet à la suite du rôle tenu", () => {
    listeCourante.contributors = [
      contributeur({ isAdmin: true, roles: ["Développeuse", "Animation"] }),
    ];
    renderSection();

    expect(
      screen.getByText("detail.contributorsSection.admin · Développeuse, Animation")
    ).toBeTruthy();
  });

  it("s'en tient au rôle tenu quand le lien n'en déclare aucun — le cas courant", () => {
    listeCourante.contributors = [contributeur({ isAdmin: true })];
    renderSection();

    expect(screen.getByText("detail.contributorsSection.admin")).toBeTruthy();
  });
});

describe("CommunContributorsSection — droit d'ajouter", () => {
  const bouton = () => screen.queryByRole("button", { name: /detail\.contributorsSection\.addCta/ });

  it("ouvre l'ajout à l'admin du projet", () => {
    projetCourant = { id: "proj-1", isAdmin: () => true };
    renderSection();
    expect(bouton()).toBeTruthy();
  });

  it("l'ouvre AUSSI au déposant qui n'administre pas le projet lié", () => {
    projetCourant = { id: "proj-1", isAdmin: () => false };
    renderSection({ isCommunAuthor: true });
    expect(bouton()).toBeTruthy();
  });

  it("le refuse au visiteur ordinaire, modale comprise", () => {
    projetCourant = { id: "proj-1", isAdmin: () => false };
    renderSection();
    expect(bouton()).toBeNull();
    expect(screen.queryByTestId("invite-dialog")).toBeNull();
  });
});

describe("CommunContributorsSection — invitations en attente", () => {
  it("ne les demande qu'à l'admin du projet, seule route que le backend lui ouvre", () => {
    projetCourant = { id: "proj-1", isAdmin: () => true };
    renderSection();
    expect(useProjectContributors).toHaveBeenCalledWith(projetCourant, { isInviting: true });
  });

  it("ne les demande PAS au déposant non-admin — il verrait un refus, pas une liste", () => {
    projetCourant = { id: "proj-1", isAdmin: () => false };
    renderSection({ isCommunAuthor: true });
    expect(useProjectContributors).toHaveBeenCalledWith(null, { isInviting: true });
  });

  it("décrit les invitations comme les autres fiches : badge et rôles compris", () => {
    projetCourant = { id: "proj-1", isAdmin: () => true };
    listeCourante.links = { u9: { isAdmin: false, roles: ["Animation"] } };
    useProjectContributors.mockReturnValue({
      contributors: [{ id: "u9", serverData: { name: "Chris", slug: "chris" } }],
    });
    renderSection({ authorId: "u9" });

    expect(screen.getByText("detail.contributorsSection.pendingInvitation · Animation")).toBeTruthy();
    expect(within(screen.getByText("Chris").parentElement!).getByText(BADGE_DEPOSANT)).toBeTruthy();
  });
});
