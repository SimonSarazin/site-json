// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import i18n from "@/i18n";
import "@/modules/aac/i18n";
import "@/modules/cagnotte/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { CagnotteFundableItem, FundingAction } from "@/modules/cagnotte/types";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";

/** Paliers et actions en deux listes (interface editorial) : contenu, droits, filtre par palier, terminées masquées. */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { CommunActionsFeed, CommunMilestonesList } = await import("./CommunActionsLists");

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

function controleur(over: Record<string, unknown> = {}): CommunObjectivesController {
  return {
    cagnottePerms: DROITS_ADMIN,
    canManageActions: true,
    isLoadingData: false,
    loadingIds: {
      candidateActionId: "",
      doneActionId: "",
      deletingActionId: "",
      deletingItemId: "",
      closingItemId: "",
      restoringItemId: "",
    },
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
    ...over,
  } as unknown as CommunObjectivesController;
}

function poserActions(
  ctrl: CommunObjectivesController,
  items: CagnotteFundableItem[],
  filtre?: { milestoneFilter: string | null; onClearMilestoneFilter: () => void },
) {
  return render(
    <LocalizationProvider>
      <CommunActionsFeed funding={{ items } as never} ctrl={ctrl} {...filtre} />
    </LocalizationProvider>,
  );
}

function poserPaliers(
  ctrl: CommunObjectivesController,
  items: CagnotteFundableItem[],
  selection?: { selectedMilestoneId: string | null; onSelectMilestone: (itemId: string | null) => void },
) {
  return render(
    <LocalizationProvider>
      <CommunMilestonesList funding={{ items } as never} ctrl={ctrl} {...selection} />
    </LocalizationProvider>,
  );
}

const DEUX_PALIERS = [
  palier(),
  palier({ itemId: "it2", milestoneId: "m2", name: "Lancement", actions: [action({ id: "a2", name: "Inauguration" })] }),
];

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

describe("CommunActionsFeed", () => {
  it("met à plat les actions de tous les paliers, chacune avec son palier, ses contributeurs et sa date", () => {
    poserActions(controleur(), [
      palier({ actions: [action({ contributors: [{ id: "u2", name: "Awa" }], created: 1700049600 })] }),
      palier({
        itemId: "it2",
        milestoneId: "m2",
        name: "Lancement",
        actions: [action({ id: "a2", name: "Inauguration", status: "done" })],
      }),
    ]);
    fireEvent.click(screen.getByRole("switch"));

    const lignes = screen.getAllByRole("listitem");
    expect(lignes).toHaveLength(2);
    expect(within(lignes[0]).getByText("Atelier")).toBeTruthy();
    expect(within(lignes[0]).getByText(/Prototype · Awa · 15\/11\/2023 · .*500.* · En cours/)).toBeTruthy();
    expect(within(lignes[1]).getByText("Inauguration")).toBeTruthy();
    expect(within(lignes[1]).getByText(/Lancement · .* · Terminée/)).toBeTruthy();
  });

  it("la case « terminée » appelle le contrôleur avec le palier de l'action", () => {
    const ctrl = controleur();
    poserActions(ctrl, [palier()]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Atelier" }));
    expect(ctrl.handleActionDone).toHaveBeenCalledWith("m1", expect.objectContaining({ id: "a1" }));
  });

  it("sans droit de clôture, la case est désactivée", () => {
    poserActions(controleur({ cagnottePerms: { ...DROITS_ADMIN, canMarkActionDone: () => false } }), [palier()]);
    expect((screen.getByRole("checkbox", { name: "Atelier" }) as HTMLInputElement).disabled).toBe(true);
  });

  it("aucune action : message vide, pas de liste", () => {
    poserActions(controleur(), [palier({ actions: [] })]);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("Aucune tâche n'a encore été ajoutée à ce commun.")).toBeTruthy();
  });

  it("rien sans `canManageActions`", () => {
    const { container } = poserActions(controleur({ canManageActions: false }), [palier()]);
    expect(container.textContent).toBe("");
  });

  it("masque les terminées par défaut ; l'interrupteur les compte et les réaffiche", () => {
    poserActions(controleur(), [
      palier({ actions: [action(), action({ id: "a2", name: "Inauguration", status: "done" })] }),
    ]);

    const interrupteur = screen.getByRole("switch", { name: "Masquer les terminées (1)" });
    expect(interrupteur.getAttribute("aria-checked")).toBe("true");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Inauguration")).toBeNull();

    fireEvent.click(interrupteur);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Inauguration")).toBeTruthy();
  });

  it("toutes terminées : message dédié, interrupteur toujours là", () => {
    poserActions(controleur(), [palier({ actions: [action({ status: "done" })] })]);

    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("Toutes les tâches sont terminées.")).toBeTruthy();
    expect(screen.getByRole("switch")).toBeTruthy();
  });

  it("filtrée sur un palier : ses seules actions, et « Toutes les actions » retire le filtre", () => {
    const retirer = vi.fn();
    poserActions(controleur(), DEUX_PALIERS, { milestoneFilter: "it2", onClearMilestoneFilter: retirer });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Inauguration")).toBeTruthy();
    expect(screen.queryByText("Atelier")).toBeNull();
    expect(screen.getByText("Jalon : Lancement")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Toutes les actions/ }));
    expect(retirer).toHaveBeenCalled();
  });

  it("filtrée sur un palier sans tâche : message propre au palier", () => {
    poserActions(controleur(), [palier(), palier({ itemId: "it2", name: "Lancement", actions: [] })], {
      milestoneFilter: "it2",
      onClearMilestoneFilter: vi.fn(),
    });
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("Aucune tâche dans ce jalon pour l'instant.")).toBeTruthy();
  });

  it("deux dépenses sur le même jalon : chaque action une seule fois, et le filtre ne laisse aucune ligne périmée", () => {
    const actions = [action({ id: "a1", name: "Design" }), action({ id: "a2", name: "Modale" })];
    const items = [
      palier({ itemId: "25", milestoneId: "m-aap", name: "AAP 0.3", actions }),
      palier({ itemId: "27", milestoneId: "m-t2", name: "T2 2023", actions: [action({ id: "a3", name: "Listing" })] }),
      palier({ itemId: "30", milestoneId: "m-aap", name: "AAP 0.3", actions }),
    ];
    const ctrl = controleur();
    const filtre = (milestoneFilter: string | null) => (
      <LocalizationProvider>
        <CommunActionsFeed funding={{ items } as never} ctrl={ctrl} milestoneFilter={milestoneFilter} onClearMilestoneFilter={vi.fn()} />
      </LocalizationProvider>
    );

    const { rerender } = render(filtre(null));
    expect(screen.getAllByRole("listitem").map((li) => within(li).getByRole("checkbox").getAttribute("aria-label")))
      .toEqual(["Design", "Modale", "Listing"]);

    rerender(filtre("25"));
    expect(screen.getAllByRole("listitem").map((li) => within(li).getByRole("checkbox").getAttribute("aria-label")))
      .toEqual(["Design", "Modale"]);
  });

  it("un filtre sur un palier disparu ne filtre rien", () => {
    poserActions(controleur(), DEUX_PALIERS, { milestoneFilter: "supprime", onClearMilestoneFilter: vi.fn() });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(/Jalon :/)).toBeNull();
  });
});

describe("CommunMilestonesList", () => {
  it("chaque palier montre son état et l'avancement de ses tâches", () => {
    poserPaliers(controleur(), [
      palier({ actions: [action(), action({ id: "a2", status: "done" })] }),
      palier({ itemId: "it2", milestoneId: "m2", name: "Lancement", status: "close", actions: [] }),
    ]);

    const [ouvert, clos] = screen.getAllByRole("listitem");
    expect(within(ouvert).getByText("En cours")).toBeTruthy();
    expect(within(ouvert).getByText("1/2 tâches")).toBeTruthy();
    expect(within(clos).getByText("Clos")).toBeTruthy();
  });

  it("garde la barre de gestion : « Ajouter une action » vise son palier, un palier clos se restaure", () => {
    const ctrl = controleur();
    poserPaliers(ctrl, [palier(), palier({ itemId: "it2", milestoneId: "m2", name: "Lancement", status: "close" })]);

    fireEvent.click(screen.getByRole("button", { name: /Ajouter une action/ }));
    expect(ctrl.handleCreateAction).toHaveBeenCalledWith("m1", "Prototype");

    fireEvent.click(screen.getByRole("button", { name: "Restaurer" }));
    expect(ctrl.handleRestoreMilestone).toHaveBeenCalledWith("it2", expect.objectContaining({ id: "m2" }));
  });

  it("aucun palier : message vide", () => {
    poserPaliers(controleur(), []);
    expect(screen.getByText("Aucun jalon pour l'instant.")).toBeTruthy();
  });

  it("un clic sélectionne le palier, un second le désélectionne", () => {
    const choisir = vi.fn();
    const { rerender } = poserPaliers(controleur(), DEUX_PALIERS, { selectedMilestoneId: null, onSelectMilestone: choisir });

    const lancement = screen.getByRole("button", { name: "Lancement" });
    expect(lancement.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(lancement);
    expect(choisir).toHaveBeenLastCalledWith("it2");

    rerender(
      <LocalizationProvider>
        <CommunMilestonesList funding={{ items: DEUX_PALIERS } as never} ctrl={controleur()} selectedMilestoneId="it2" onSelectMilestone={choisir} />
      </LocalizationProvider>,
    );
    expect(screen.getByRole("button", { name: "Lancement" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Lancement" }));
    expect(choisir).toHaveBeenLastCalledWith(null);
  });

  it("sans `onSelectMilestone`, le nom du palier n'est pas un bouton", () => {
    poserPaliers(controleur(), DEUX_PALIERS);
    expect(screen.queryByRole("button", { name: "Lancement" })).toBeNull();
  });
});
