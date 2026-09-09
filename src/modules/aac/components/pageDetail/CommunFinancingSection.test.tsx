// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { AacResolvedConfig } from "../../types";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";

/**
 * « Besoins financiers » sur la fiche d'un commun (review MR 53, lot 2).
 *
 * Le contrôleur est un STUB : ses handlers et ses permissions n'entrent pas
 * dans ce qui est vérifié ici — seul le rendu de la liste des paliers l'est.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    if (!params) return base;
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), base);
  },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

let depenses: Array<Record<string, unknown>> = [];
const useCommunRawDepenses = vi.fn(() => ({ data: depenses }));
vi.mock("@/modules/aac/hooks/useCommunRawDepenses", () => ({
  useCommunRawDepenses: (...args: unknown[]) => useCommunRawDepenses(...(args as [])),
}));

const { CommunFinancingSection } = await import("./CommunFinancingSection");

function makeConfig(depenseStepKey: string | null): AacResolvedConfig {
  return {
    formId: "f1",
    configId: null,
    aapType: "aac",
    steps: [],
    roles: { depenseStepKey, evalStepKey: null, financementStepKey: null, suiviStepKey: null },
    criteria: [],
    criteriaSource: "none",
    gates: {
      active: true,
      onlyMemberAccess: false,
      oneAnswerPerPers: false,
      canReadOtherAnswers: false,
      showAnswers: false,
      coremu: true,
      anyOnewithLinkCanAnswer: false,
    },
    campaigns: [],
    typeCoFinancer: null,
  };
}

/** Le strict nécessaire du contrôleur pour rendre la liste — aucun droit de gestion. */
function makeCtrl(): CommunObjectivesController {
  return {
    resolvedAnswerId: "a1",
    cagnottePerms: {
      canCreateMilestone: false,
      canEditMilestone: () => false,
      canCloseMilestone: () => false,
      canDeleteMilestone: () => false,
    },
    openCreateMilestoneModal: vi.fn(),
    openEditMilestoneModal: vi.fn(),
    handleCloseMilestone: vi.fn(),
    handleRestoreMilestone: vi.fn(),
    handleDeleteMilestone: vi.fn(),
    loadingIds: { deletingItemId: "", closingItemId: "", restoringItemId: "" },
  } as unknown as CommunObjectivesController;
}

function renderSection(over: Partial<Parameters<typeof CommunFinancingSection>[0]> = {}) {
  return render(
    <LocalizationProvider>
      <CommunFinancingSection
        formData={{ id: "f1", name: "Appel", inputs: {} } as never}
        aacConfig={makeConfig("etapeA")}
        funding={null}
        ctrl={makeCtrl()}
        {...over}
      />
    </LocalizationProvider>,
  );
}

beforeEach(() => {
  depenses = [];
  useCommunRawDepenses.mockClear();
});

describe("CommunFinancingSection — l'étape des dépenses est celle que la page a résolue (M13)", () => {
  it("passe `roles.depenseStepKey` à `useCommunRawDepenses`, jamais `aapStep1` en dur", () => {
    renderSection({ aacConfig: makeConfig("etapeA") });
    expect(useCommunRawDepenses).toHaveBeenCalledWith("a1", "etapeA");
  });
});
