// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { CagnotteResource } from "@/modules/cagnotte/types";

/**
 * M40 (review MR 53) : la réparation des dépenses orphelines n'est plus un effet
 * de l'adaptateur mais un opt-in des surfaces d'édition. La fiche commun et
 * `MilestoneListField` passent toutes deux par ce hook : c'est LUI qui monte
 * `useOrphanDepenseRepair`, sur la ressource du commun, avec le droit de créer un
 * palier — calculé comme le contrôleur de la fiche : entité du projet lié +
 * déposant (`ownerIds`).
 */

const mocks = vi.hoisted(() => ({
  savedSelectedResource: undefined as CagnotteResource | undefined,
  pendingMilestoneRepairs: [] as unknown[],
  useOrphanDepenseRepair: vi.fn(),
  useCagnottePermissions: vi.fn(),
  useCommunProjectEntity: vi.fn(),
  canCreateMilestone: false,
  projectEntity: null as unknown,
}));

vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ entity: null, me: null, api: null }) }));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: {} }) }));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelope", () => ({ useFundingEnvelope: () => ({ data: undefined }) }));
vi.mock("@/modules/cagnotte/hooks/useCagnotteType", () => ({ useCagnotteType: () => ({ config: { selectorType: "proposition" } }) }));
vi.mock("@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers", () => ({
  useOrganizationProjectsWithAnswers: () => ({ projects: [] }),
}));
vi.mock("@/modules/cagnotte/hooks/useCagnotteAdapter", () => ({
  useCagnotteAdapter: () => ({
    resources: [],
    savedSelectedResource: mocks.savedSelectedResource,
    pendingMilestoneRepairs: mocks.pendingMilestoneRepairs,
  }),
  useOrphanDepenseRepair: (...args: unknown[]) => mocks.useOrphanDepenseRepair(...args),
}));
vi.mock("@/modules/cagnotte/hooks/useCagnottePermissions", () => ({
  useCagnottePermissions: (...args: unknown[]) => {
    mocks.useCagnottePermissions(...args);
    return { canCreateMilestone: mocks.canCreateMilestone };
  },
}));
vi.mock("@/modules/aac/hooks/useCommunProjectEntity", () => ({
  useCommunProjectEntity: (...args: unknown[]) => {
    mocks.useCommunProjectEntity(...args);
    return mocks.projectEntity;
  },
}));

const { useAacFundingResource } = await import("./useAacFundingResource");

const RESSOURCE = {
  fromType: "proposition",
  id: "answer-1",
  name: "Mon commun",
  answerId: "answer-1",
  projectId: "proj-1",
  resourceTotalAmount: 0,
  resourceFinancedAmount: 0,
  items: [],
} as unknown as CagnotteResource;

const REPARATION = { projectId: "proj-1", answerId: "answer-1", milestoneId: "m-new", name: "Legacy", description: "", depenseIndex: 0 };

afterEach(() => {
  mocks.savedSelectedResource = undefined;
  mocks.pendingMilestoneRepairs = [];
  mocks.canCreateMilestone = false;
  mocks.projectEntity = null;
  vi.clearAllMocks();
});

describe("useAacFundingResource — monte la réparation des orphelines, gardée par le droit", () => {
  it("passe la ressource du commun, ses réparations, et `canCreateMilestone` comme droit", () => {
    mocks.savedSelectedResource = RESSOURCE;
    mocks.pendingMilestoneRepairs = [REPARATION];
    mocks.canCreateMilestone = true;

    renderHook(() => useAacFundingResource("answer-1", { answer: { userId: "deposant" } }));

    expect(mocks.useOrphanDepenseRepair).toHaveBeenCalledWith({
      resource: RESSOURCE,
      repairs: [REPARATION],
      enabled: true,
    });
  });

  it("sans le droit, la réparation est montée désactivée — rien ne s'écrit", () => {
    mocks.savedSelectedResource = RESSOURCE;
    mocks.pendingMilestoneRepairs = [REPARATION];
    mocks.canCreateMilestone = false;

    renderHook(() => useAacFundingResource("answer-1"));

    expect(mocks.useOrphanDepenseRepair).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("le droit se calcule sur l'entité du projet lié et le déposant du commun, comme sur la fiche", () => {
    mocks.savedSelectedResource = RESSOURCE;
    const projet = { id: "proj-1" };
    mocks.projectEntity = projet;

    renderHook(() => useAacFundingResource("answer-1", { answer: { userId: "deposant" } }));

    expect(mocks.useCommunProjectEntity).toHaveBeenCalledWith("proj-1");
    expect(mocks.useCagnottePermissions).toHaveBeenCalledWith(projet, { ownerIds: ["deposant"] });
  });

  it("sans document réponse en main, aucun `ownerIds` — seul l'admin du projet lié répare", () => {
    mocks.savedSelectedResource = RESSOURCE;

    renderHook(() => useAacFundingResource("answer-1"));

    expect(mocks.useCagnottePermissions).toHaveBeenCalledWith(null, { ownerIds: [] });
  });
});
