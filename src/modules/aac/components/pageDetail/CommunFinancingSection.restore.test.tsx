// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "@/i18n";
import "@/modules/aac/i18n";
import "@/modules/cagnotte/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { CagnotteFundableItem } from "@/modules/cagnotte/types";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";

/**
 * Le bloc « Besoins financiers » porte la MÊME barre de gestion de palier que
 * « Suivi des actions » : « Restaurer » y suit `canRestoreMilestone` — ni le droit
 * d'édition (refusé sur un palier clos), ni celui de suppression (refusé sur un
 * palier financé). Sans quoi un palier clos ET financé n'était plus jamais
 * restaurable d'ici non plus.
 */

// La liste est pilotée par les dépenses brutes de la réponse ; l'enveloppe ne fait
// qu'enrichir (financement collecté, actions). On fournit les deux.
let depensesBrutes: Array<Record<string, unknown>> = [];
vi.mock("@/modules/aac/hooks/useCommunRawDepenses", () => ({
  useCommunRawDepenses: () => ({ data: depensesBrutes }),
}));

const { CommunFinancingSection } = await import("./CommunFinancingSection");

function palier(over: Partial<CagnotteFundableItem> = {}): CagnotteFundableItem {
  return {
    fromType: "milestone",
    itemId: "it1",
    milestoneId: "m1",
    depenseIndex: 0,
    name: "Prototype",
    price: 2000,
    status: "open",
    actions: [],
    funding: [],
    currentFunding: 0,
    unpaidFunding: 0,
    userPledge: 0,
    allFunding: [],
    ...over,
  };
}

/** Les droits tels que le calculateur cagnotte les rend à un admin du projet. */
const DROITS_ADMIN = {
  canCreateMilestone: true,
  canEditMilestone: ({ status }: { status: string }) => status !== "close",
  canCloseMilestone: ({ status }: { status: string }) => status === "open",
  canRestoreMilestone: ({ status }: { status: string }) => status === "close",
  canDeleteMilestone: ({ hasTransactions }: { hasTransactions?: boolean }) => hasTransactions !== true,
};

function controleur(over: Record<string, unknown> = {}): CommunObjectivesController {
  return {
    cagnottePerms: DROITS_ADMIN,
    resolvedAnswerId: "ans1",
    loadingIds: { deletingItemId: "", closingItemId: "", restoringItemId: "" },
    openCreateMilestoneModal: vi.fn(),
    openEditMilestoneModal: vi.fn(),
    handleCloseMilestone: vi.fn(),
    handleDeleteMilestone: vi.fn(),
    handleRestoreMilestone: vi.fn(),
    ...over,
  } as unknown as CommunObjectivesController;
}

function poser(ctrl: CommunObjectivesController, items: CagnotteFundableItem[]) {
  return render(
    <LocalizationProvider>
      <CommunFinancingSection formData={{} as never} aacConfig={null} funding={{ items } as never} ctrl={ctrl} />
    </LocalizationProvider>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

describe("CommunFinancingSection — restauration d'un palier clos", () => {
  const restaurer = () => screen.queryByRole("button", { name: "Restaurer" });

  it("un palier clos ET financé garde son bouton « Restaurer »", () => {
    // `include: false` sur la dépense = palier clos ; le collecté vient de l'enveloppe.
    depensesBrutes = [{ id: "d1", poste: "Prototype", price: 2000, milestone: "m1", include: false }];
    const ctrl = controleur();
    poser(ctrl, [palier({ currentFunding: 2000 })]);

    expect(restaurer()).toBeTruthy();
    fireEvent.click(restaurer()!);
    expect(ctrl.handleRestoreMilestone).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({ id: "m1", title: "Prototype" }),
    );
  });

  it("« Restaurer » suit `canRestoreMilestone`, pas le droit de suppression", () => {
    depensesBrutes = [{ id: "d1", poste: "Prototype", price: 2000, milestone: "m1", include: false }];
    poser(
      controleur({ cagnottePerms: { ...DROITS_ADMIN, canRestoreMilestone: () => false } }),
      [palier({ currentFunding: 0 })],
    );

    expect(restaurer()).toBeNull();
  });
});
