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
      // Restauration d'un palier clos (lot 2, G6/H7) : le composant la consulte aussi.
      canRestoreMilestone: () => false,
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

describe("CommunFinancingSection — un palier clos est marqué comme tel (M17)", () => {
  /**
   * La carte et la table des cofinanceurs excluent les paliers clos de leurs
   * totaux ; la liste, elle, les gardait sans aucun marqueur — le lecteur
   * additionnait « 900 € / 900 € » absents du « 0 € sur 100 € » annoncé au-dessus.
   * Le palier reste listé (c'est là qu'on le restaure), mais badgé.
   */
  it("badge « clos » sur le palier `include: false`, aucun sur le palier ouvert", () => {
    depenses = [
      { poste: "Ouvert", priceInt: 100 },
      { poste: "Clos", priceInt: 900, include: false, financer: [{ id: "u1", amount: 900 }] },
    ];
    renderSection();

    expect(screen.getByText("Ouvert")).toBeTruthy();
    expect(screen.getByText("Clos")).toBeTruthy();
    const badges = screen.getAllByText("detail.objectives.closedBadge");
    expect(badges).toHaveLength(1);
    // Le badge est dans la carte du palier CLOS, pas dans celle du palier ouvert.
    expect(badges[0].closest("button")?.textContent).toContain("Clos");
    expect(badges[0].closest("button")?.textContent).not.toContain("Ouvert");
  });
});
