// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Deux invariants de cette section, tous deux nés d'un défaut observé :
 *
 * 1. Un clic sur un bouton d'action ne doit PAS replier la carte. Les boutons
 *    vivent dans la branche `isExpanded &&` d'une carte qui porte
 *    `onClick={onToggle}` : sans arrêt de propagation, le clic repliait la
 *    carte, démontant le composant du bouton, son état `isModalOpen` et le
 *    `onSuccess` de connexion. Pour un utilisateur connecté, l'action était
 *    simplement MORTE — sur les 6 communes de commune-transparente.
 *
 * 2. Un visiteur non connecté doit se voir proposer la CONNEXION, pas un
 *    `toast.error` constatant le blocage sans issue.
 */

const state = vi.hoisted(() => ({
  me: null as unknown,
  openLogin: vi.fn(),
}));

vi.mock("@/hooks/useLocalization", () => ({
  useLocalization: () => ({ t: (v: unknown) => (typeof v === "string" ? v : (v as { fr: string })?.fr ?? "") }),
}));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me: state.me, entity: null }),
}));
vi.mock("@/modules/auth", () => ({
  useAuthModal: () => ({ openLogin: state.openLogin }),
}));
vi.mock("@/modules/profil/components/add/ModalRegistry", () => ({
  DynamicModal: ({ open }: { open: boolean }) => (open ? <div data-testid="add-modal" /> : null),
}));
vi.mock("lucide-react/dynamic", () => ({ DynamicIcon: () => <span /> }));
vi.mock("react-router", () => ({
  Link: ({ children, ...p }: React.ComponentProps<"a">) => <a {...p}>{children}</a>,
}));

import { ExpandableActions } from "./ExpandableActions";

const PROPS = {
  items: [
    {
      title: { fr: "Projets Locaux" },
      description: { fr: "Portez un projet." },
      icon: "folder",
      buttons: [
        { label: { fr: "Proposer un projet" }, modal: "add-project" },
        { label: { fr: "Voir les projets" }, href: "/projets", variant: "secondary" as const },
      ],
    },
  ],
} as never;

function deplier() {
  fireEvent.click(screen.getByText("Projets Locaux"));
}

describe("ExpandableActions — le clic sur un bouton ne replie pas la carte", () => {
  beforeEach(() => {
    state.me = { id: "u1" };
    state.openLogin.mockClear();
  });

  it("déplie au clic sur la carte", () => {
    render(<ExpandableActions props={PROPS} />);
    expect(screen.queryByText("Proposer un projet")).not.toBeInTheDocument();
    deplier();
    expect(screen.getByText("Proposer un projet")).toBeInTheDocument();
  });

  it("🔒 connecté : le clic ouvre la modale ET la carte RESTE dépliée", () => {
    render(<ExpandableActions props={PROPS} />);
    deplier();
    fireEvent.click(screen.getByText("Proposer un projet"));

    // Sans stopPropagation, ces deux assertions échouent ensemble : la carte se
    // replie, le bouton disparaît et la modale n'est jamais montée.
    expect(screen.getByText("Proposer un projet")).toBeInTheDocument();
    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
  });

  it("🔒 le clic sur un bouton-lien ne replie pas non plus la carte", () => {
    render(<ExpandableActions props={PROPS} />);
    deplier();
    fireEvent.click(screen.getByText("Voir les projets"));
    expect(screen.getByText("Proposer un projet")).toBeInTheDocument();
  });
});

describe("ExpandableActions — visiteur non connecté", () => {
  beforeEach(() => {
    state.me = null;
    state.openLogin.mockClear();
  });

  it("ouvre le modal de connexion au lieu de bloquer, et n'ouvre pas le formulaire", () => {
    render(<ExpandableActions props={PROPS} />);
    deplier();
    fireEvent.click(screen.getByText("Proposer un projet"));

    expect(state.openLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();
  });

  it("le `onSuccess` transmis rejoue l'ouverture demandée — et le bouton est encore monté pour la recevoir", () => {
    render(<ExpandableActions props={PROPS} />);
    deplier();
    fireEvent.click(screen.getByText("Proposer un projet"));

    const { onSuccess } = state.openLogin.mock.calls[0][0];
    expect(typeof onSuccess).toBe("function");
    expect(screen.getByText("Proposer un projet")).toBeInTheDocument();
  });
});
