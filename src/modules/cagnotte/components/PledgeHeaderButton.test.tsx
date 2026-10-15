// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici : le tooltip du bouton « promesses », le montant affiché (le solde à
 * régler), le bouton visible pour tout connecté même sans reste à régler (accès aux paiements) et
 * le fait que le clic ouvre toujours la modale. Les hooks data sont mockés à leur frontière.
 */

const state = vi.hoisted(() => {
  // Une promesse entamée : 1 000 € engagés, 600 € à régler.
  const promesse = { id: "p1", resourceId: "ans1", fundingAmount: 1000, remainingAmount: 600 };
  return { promesse, loggedIn: true, pledges: [promesse] as Array<Record<string, unknown>> };
});

// jsdom ne fournit pas ResizeObserver, dont le Popper de `TooltipContent` a besoin.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    // `getEntityType` : le composant passe `me` à `isUser()` avant tout rendu.
    me: state.loggedIn ? { id: "u1", serverData: { id: "u1" }, getEntityType: () => "citoyens" } : null,
    entity: { serverData: {} },
  }),
}));
vi.mock("@/hooks/useReactiveProperty", () => ({ useReactiveProperty: () => ({}) }));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: {} }) }));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelope", () => ({
  useFundingEnvelope: () => ({ data: undefined }),
}));
vi.mock("@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers", () => ({
  useOrganizationProjectsWithAnswers: () => ({ projects: [] }),
}));
vi.mock("@/modules/cagnotte/hooks/useUserAdminOrganizations", () => ({
  useUserAdminOrganizations: () => [],
}));
vi.mock("@/modules/cagnotte/hooks/useCagnotteAdapter", () => ({
  useCagnotteAdapter: () => ({ resources: [] }),
  computePledgesFromResources: () => state.pledges,
}));
vi.mock("./PromessesDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="promesses-open" /> : null),
}));

const { PledgeHeaderButton } = await import("./PledgeHeaderButton");

afterEach(() => {
  state.loggedIn = true;
  state.pledges = [state.promesse];
});

describe("PledgeHeaderButton — tooltip", () => {
  it("affiche le tooltip au focus du bouton", async () => {
    render(<PledgeHeaderButton />);

    expect(screen.queryByText("Mes promesses à régler et mes paiements")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole("button", { name: "Voir les promesses" }));

    // Radix duplique le texte dans un `VisuallyHidden` role=tooltip → getAll.
    expect((await screen.findAllByText("Mes promesses à régler et mes paiements")).length).toBeGreaterThan(0);
  });

  it("ouvre toujours la modale des promesses au clic", async () => {
    render(<PledgeHeaderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Voir les promesses" }));

    expect(await screen.findByTestId("promesses-open")).toBeInTheDocument();
  });
});

describe("PledgeHeaderButton — montant", () => {
  it("affiche le solde à régler, pas le montant engagé", () => {
    render(<PledgeHeaderButton />);

    expect(screen.getByRole("button", { name: "Voir les promesses" })).toHaveTextContent("600 €");
  });

  it("sans reste à régler : bouton visible, sans montant", () => {
    state.pledges = [];
    render(<PledgeHeaderButton />);

    expect(screen.getByRole("button", { name: "Voir les promesses" })).not.toHaveTextContent("€");
  });

  it("non connecté : aucun bouton", () => {
    state.loggedIn = false;
    render(<PledgeHeaderButton />);

    expect(screen.queryByRole("button", { name: "Voir les promesses" })).not.toBeInTheDocument();
  });
});
