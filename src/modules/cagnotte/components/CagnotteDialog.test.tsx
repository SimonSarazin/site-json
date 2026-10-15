// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CagnotteResource } from "@/modules/cagnotte/types";

/**
 * Ce qui est verrouillé ici : une ressource désignée par un alias (projectId d'une proposition,
 * comme le passe le bouton du header) est sélectionnée par son id canonique, et le bouton
 * « Contribuer » apparaît. Les hooks data sont mockés à leur frontière.
 */

const state = vi.hoisted(() => {
  const proposition = {
    fromType: "proposition",
    id: "ans1",
    answerId: "ans1",
    projectId: "proj1",
    name: "Ma proposition",
    resourceTotalAmount: 1000,
    resourceFinancedAmount: 0,
    items: [{
      fromType: "depense",
      itemId: "d0",
      milestoneId: "",
      depenseIndex: 0,
      name: "Dépense",
      description: "",
      price: 1000,
      status: "open",
      actions: [],
      currentFunding: 0,
      unpaidFunding: 0,
      userPledge: 0,
      funding: [],
      allFunding: [],
    }],
  };
  return { proposition: proposition as unknown as CagnotteResource };
});

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => (typeof fallback === "string" ? fallback : key),
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    me: { id: "u1", serverData: { id: "u1" }, getEntityType: () => "citoyens" },
    entity: { serverData: {} },
  }),
}));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: {} }) }));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelope", () => ({
  useFundingEnvelope: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers", () => ({
  useOrganizationProjectsWithAnswers: () => ({ projects: [], isLoading: false }),
}));
vi.mock("@/modules/cagnotte/hooks/useUserAdminOrganizations", () => ({
  useUserAdminOrganizations: () => [],
}));
// Comme l'adaptateur réel : `savedSelectedResource` est cherchée par `id` seul.
vi.mock("@/modules/cagnotte/hooks/useCagnotteAdapter", () => ({
  useCagnotteAdapter: (_env: unknown, _projects: unknown, _config: unknown, selectedId: string) => ({
    resources: [state.proposition],
    savedSelectedResource: state.proposition.id === selectedId ? state.proposition : undefined,
  }),
  computePledgesFromResources: () => [],
}));
vi.mock("@/modules/cagnotte/hooks/useCagnottePermissions", () => ({
  useCagnottePermissions: (_entity: unknown, data: { hasActiveItems?: boolean; resourceId?: string }) => ({
    canContribute: Boolean(data.resourceId) && Boolean(data.hasActiveItems),
    isAdmin: false,
  }),
}));
vi.mock("@/modules/cagnotte/hooks/useResourceModalPreference", () => ({
  useResourceModalPreference: () => ({ save: vi.fn(), isSaving: false }),
}));

const { default: CagnotteDialog } = await import("./CagnotteDialog");

describe("CagnotteDialog — sélecteur de proposition", () => {
  it("affiche « Contribuer » quand la proposition est désignée par son projectId", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CagnotteDialog totalAmount={0} defaultResourceId="proj1" cagnotteType="aac">
          <button type="button">ouvrir</button>
        </CagnotteDialog>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "ouvrir" }));
    fireEvent.click(await screen.findByRole("radio", { name: "10€" }));

    expect(await screen.findByRole("button", { name: /CagnotteDialog\.labels\.contribute/ })).toBeEnabled();
  });
});
