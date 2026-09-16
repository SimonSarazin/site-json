// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { CagnotteType } from "@/modules/cagnotte/types";

/**
 * M9 : `useOrganizationProjectsWithAnswers` (un `searchCostum` borné à 10 000
 * projets + un `api.answer` PAR projet) n'est lu par `useCagnotteAdapter` que
 * dans sa branche `selectorType === "project"`. Sur un site AAC
 * (`defaultType: "aac"` ⇒ `proposition`), il ne doit pas partir du tout.
 *
 * Le hook coûteux est RÉEL ici (React Query) ; on espionne `entity.searchCostum`,
 * sa première requête. L'enveloppe et l'adaptateur sont hors sujet : mockés.
 */

const mocks = vi.hoisted(() => ({
  defaultType: "aac" as CagnotteType,
  searchCostum: vi.fn(async (_params: Record<string, unknown>) => ({ results: [] as unknown[] })),
}));

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    api: null,
    me: null,
    entity: { id: "org-1", slug: "orga", searchCostum: mocks.searchCostum },
  }),
}));
vi.mock("@/hooks/useSite", () => ({
  useSite: () => ({ config: { cagnotteModuleConfig: { defaultType: mocks.defaultType } } }),
}));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelope", () => ({
  useFundingEnvelope: () => ({ data: undefined }),
}));
vi.mock("@/modules/cagnotte/hooks/useCagnotteAdapter", () => ({
  useCagnotteAdapter: () => ({ savedSelectedResource: null }),
  // Réparation opt-in des dépenses orphelines (lot 2, G7) : sans effet ici.
  useOrphanDepenseRepair: () => {},
}));
// `getApi` n'est atteint qu'avec des projets retournés ; le SDK n'a rien à faire ici.
vi.mock("@/lib/apiClient", () => ({ getApi: vi.fn() }));

const { useAacFundingResource } = await import("./useAacFundingResource");

function renderResource() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(LocalizationProvider, null, children)
    );
  return renderHook(() => useAacFundingResource("answer-1"), { wrapper });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(() => {
  mocks.defaultType = "aac";
  vi.clearAllMocks();
});

describe("useAacFundingResource — projets de l'organisation (M9)", () => {
  it("en mode `aac` (proposition), aucun `searchCostum` : son résultat ne serait jamais lu", async () => {
    const { result } = renderResource();

    await flush();

    expect(result.current.targetResource).toBeUndefined();
    expect(mocks.searchCostum).not.toHaveBeenCalled();
  });

  it("témoin — en mode `standard` (project), la liste des projets est bien chargée", async () => {
    mocks.defaultType = "standard";
    renderResource();

    await waitFor(() => expect(mocks.searchCostum).toHaveBeenCalledTimes(1));
    expect(mocks.searchCostum.mock.calls[0][0]).toMatchObject({ searchType: ["projects"] });
  });
});
