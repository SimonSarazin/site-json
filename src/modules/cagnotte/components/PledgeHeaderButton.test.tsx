// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici : le tooltip du bouton « promesses », et le fait que le clic ouvre
 * toujours la modale de paiement. Les hooks data sont mockés à leur frontière.
 */

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
    me: { id: "u1", serverData: { id: "u1" }, getEntityType: () => "citoyens" },
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
  // Une seule promesse non nulle : le bouton n'est rendu que si le total > 0.
  computePledgesFromResources: () => [{ fundingAmount: 120 }],
}));
vi.mock("./PromessesDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="promesses-open" /> : null),
}));

const { PledgeHeaderButton } = await import("./PledgeHeaderButton");

describe("PledgeHeaderButton — tooltip", () => {
  it("affiche le tooltip au focus du bouton", async () => {
    render(<PledgeHeaderButton />);

    expect(screen.queryByText("Voir et payer mes promesses en cours")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole("button", { name: "Voir les promesses" }));

    // Radix duplique le texte dans un `VisuallyHidden` role=tooltip → getAll.
    expect((await screen.findAllByText("Voir et payer mes promesses en cours")).length).toBeGreaterThan(0);
  });

  it("ouvre toujours la modale des promesses au clic", async () => {
    render(<PledgeHeaderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Voir les promesses" }));

    expect(await screen.findByTestId("promesses-open")).toBeInTheDocument();
  });
});
