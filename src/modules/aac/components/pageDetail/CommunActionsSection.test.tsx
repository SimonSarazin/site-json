// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import "@/modules/aac/i18n";
import "@/modules/cagnotte/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { CagnotteFundableItem, FundingAction } from "@/modules/cagnotte/types";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";

/**
 * Ce que le bloc « Suivi des actions » décide, au-delà du contrôleur qu'il reçoit :
 *  1. le contexte d'édition d'une action est STABLE d'un rendu à l'autre — le
 *     dialogue (réel ici) fait `form.reset()` sur son identité, une saisie en cours
 *     ne doit pas être effacée parce que le parent s'est rerendu ;
 *  2. QUI voit la barre de gestion d'un palier, et en particulier « Restaurer »,
 *     qui suit `canRestoreMilestone` — ni le droit d'édition, ni celui de suppression.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// La modale de création a ses propres dépendances (mutation de création,
// résolution d'id) hors du périmètre de CE composant.
vi.mock("@/modules/cagnotte/components/sections/parts/ActionCreateDialog", () => ({
  ActionCreateDialog: () => null,
}));

// Le dialogue d'ÉDITION est monté pour de vrai : c'est son `form.reset()` que l'on
// éprouve. Seule sa mutation est neutralisée.
vi.mock("@/modules/cagnotte/actions/mutations", () => ({
  useEditAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Les pickers du dialogue (membres, dates, tags) portent leurs propres dépendances
// (API, calendrier, suggestions) : neutralisés — seul le champ « nom » nous intéresse.
vi.mock("@/components/form/SelectMember", () => ({ SelectMember: () => null }));
vi.mock("@/components/form/DatePickerInput", () => ({ DatePickerInput: () => null }));
vi.mock("@/components/form/TagsInput", () => ({ TagsInput: () => null }));

const { CommunActionsSection } = await import("./CommunActionsSection");

function action(over: Partial<FundingAction> = {}): FundingAction {
  return { id: "a1", name: "Atelier", credits: 500, status: "todo", tags: [], contributors: [], ...over };
}

function palier(over: Partial<CagnotteFundableItem> = {}): CagnotteFundableItem {
  return {
    fromType: "milestone",
    itemId: "it1",
    milestoneId: "m1",
    depenseIndex: 0,
    name: "Prototype",
    price: 2000,
    status: "open",
    actions: [action()],
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
  canCreateAction: ({ status }: { status: string }) => status !== "close",
  canEditAction: () => true,
  canDeleteAction: () => true,
  canMarkActionDone: () => true,
  canCandidateAction: () => false,
  isConnected: true,
  isAdmin: true,
  currentUserId: "u1",
};

const AUCUN_CHARGEMENT = {
  candidateActionId: "",
  doneActionId: "",
  deletingActionId: "",
  deletingItemId: "",
  closingItemId: "",
  restoringItemId: "",
};

function controleur(over: Record<string, unknown> = {}): CommunObjectivesController {
  return {
    cagnottePerms: DROITS_ADMIN,
    canManageActions: true,
    isConnected: true,
    currentUserId: "u1",
    resolvedProjectId: "p1",
    resolvedAnswerId: "ans1",
    projectEntity: null,
    actionCtx: { api: null, projectId: "p1", project: null },
    loadingIds: AUCUN_CHARGEMENT,
    isCreateActionOpen: false,
    setIsCreateActionOpen: vi.fn(),
    isEditActionOpen: false,
    setIsEditActionOpen: vi.fn(),
    selectedMilestoneId: "",
    selectedMilestoneTitle: "",
    selectedAction: null,
    pendingDeleteAction: null,
    cancelDeleteAction: vi.fn(),
    confirmDeleteAction: vi.fn(),
    openCreateMilestoneModal: vi.fn(),
    openEditMilestoneModal: vi.fn(),
    handleCloseMilestone: vi.fn(),
    handleDeleteMilestone: vi.fn(),
    handleRestoreMilestone: vi.fn(),
    handleCreateAction: vi.fn(),
    handleActionCandidate: vi.fn(),
    handleActionDone: vi.fn(),
    handleActionDelete: vi.fn(),
    handleActionEdit: vi.fn(),
    refetchFundingEnvelope: vi.fn(),
    ...over,
  } as unknown as CommunObjectivesController;
}

function envelopper(node: ReactNode) {
  return <LocalizationProvider>{node}</LocalizationProvider>;
}

function poser(ctrl: CommunObjectivesController, items: CagnotteFundableItem[]) {
  const section = (c: CommunObjectivesController) =>
    envelopper(
      <CommunActionsSection
        formData={{} as never}
        aacConfig={null}
        funding={{ items } as never}
        ctrl={c}
      />,
    );
  const utils = render(section(ctrl));
  return { ...utils, rerender: (c: CommunObjectivesController) => utils.rerender(section(c)) };
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

describe("CommunActionsSection — édition d'une action", () => {
  const champNom = () => screen.getByRole("textbox", { name: "Nom de l'action" }) as HTMLInputElement;

  it("la saisie en cours survit à un rerendu du parent", async () => {
    const cible = action();
    const ctrl = controleur({
      isEditActionOpen: true,
      selectedMilestoneId: "m1",
      selectedMilestoneTitle: "Prototype",
      selectedAction: cible,
    });
    const { rerender } = poser(ctrl, [palier()]);

    expect(champNom().value).toBe("Atelier");
    fireEvent.change(champNom(), { target: { value: "Atelier 2" } });
    expect(champNom().value).toBe("Atelier 2");

    // Le parent se rerend — refetch au retour du focus, spinner d'une opération
    // sur un AUTRE palier… — avec la MÊME action sélectionnée.
    await act(async () => {
      rerender(controleur({ ...ctrl, loadingIds: { ...AUCUN_CHARGEMENT, closingItemId: "it2" } }));
    });

    expect(champNom().value).toBe("Atelier 2");
  });

  it("ouvre le dialogue sur l'action sélectionnée, palier et action nommés", () => {
    poser(
      controleur({
        isEditActionOpen: true,
        selectedMilestoneId: "m1",
        selectedMilestoneTitle: "Prototype",
        selectedAction: action({ name: "Maquette", credits: 800 }),
      }),
      [palier()],
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(champNom().value).toBe("Maquette");
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("800");
  });
});

describe("CommunActionsSection — restauration d'un palier clos", () => {
  const restaurer = () => screen.queryByRole("button", { name: "Restaurer" });

  it("un palier clos ET financé garde son bouton « Restaurer » — le parcours nominal de clôture", () => {
    // Ni éditable (clos), ni supprimable (financé) : seul le droit de restauration reste.
    const ctrl = controleur();
    poser(ctrl, [palier({ status: "close", currentFunding: 2000, actions: [action({ status: "done" })] })]);

    expect(restaurer()).toBeTruthy();
    fireEvent.click(restaurer()!);
    expect(ctrl.handleRestoreMilestone).toHaveBeenCalledWith(
      "it1",
      expect.objectContaining({ id: "m1", title: "Prototype" }),
    );
  });

  it("« Restaurer » suit `canRestoreMilestone`, pas le droit de suppression", () => {
    // Clos SANS financement : supprimable, donc la barre s'affiche — mais sans droit
    // de restauration, le bouton n'a pas à y être.
    poser(
      controleur({ cagnottePerms: { ...DROITS_ADMIN, canRestoreMilestone: () => false } }),
      [palier({ status: "close", currentFunding: 0 })],
    );

    expect(restaurer()).toBeNull();
  });

  it("un palier ouvert ne propose pas de restauration", () => {
    poser(controleur(), [palier({ status: "open" })]);
    expect(restaurer()).toBeNull();
    expect(screen.getByRole("button", { name: "Clôturer" })).toBeTruthy();
  });
});
