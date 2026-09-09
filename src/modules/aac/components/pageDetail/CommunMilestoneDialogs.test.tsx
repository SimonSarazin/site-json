// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";

/**
 * Les dialogues de palier de la fiche d'un commun (review MR 53, lot 2 — H4).
 *
 * Les dialogues eux-mêmes (cagnotte) sont des stubs : seul le CÂBLAGE de leurs
 * callbacks vers les caches de la fiche est sous test. Le `QueryClient` est
 * réel — c'est bien l'invalidation qui est vérifiée, pas un mock du client.
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("@/components/shared/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("@/modules/cagnotte/components/sections/parts/MilestoneEditDialog", () => ({
  MilestoneEditDialog: () => null,
}));

/** Le stub expose le callback `onCreated` — ce que le vrai dialogue joue après un succès. */
vi.mock("@/modules/cagnotte/components/sections/CreateMilestoneDialog", () => ({
  default: ({ onCreated }: { onCreated?: (p: unknown) => void | Promise<void> }) => (
    <button type="button" onClick={() => void onCreated?.({ milestoneId: "m1", name: "Serveur", targetAmount: 100 })}>
      milestone-created
    </button>
  ),
}));

const { CommunMilestoneDialogs } = await import("./CommunMilestoneDialogs");

const refetchFundingEnvelope = vi.fn().mockResolvedValue(undefined);

function makeCtrl(): CommunObjectivesController {
  return {
    resolvedAnswerId: "a1",
    resolvedProjectId: "p1",
    currentUserId: "u1",
    existingMilestoneIds: [],
    isConnected: true,
    isCreateMilestoneOpen: true,
    setIsCreateMilestoneOpen: vi.fn(),
    isEditMilestoneOpen: false,
    setIsEditMilestoneOpen: vi.fn(),
    selectedMilestone: null,
    setSelectedMilestone: vi.fn(),
    milestoneEditInitialValues: null,
    activeEditMilestoneMutation: {},
    pendingDeleteMilestone: null,
    cancelDeleteMilestone: vi.fn(),
    confirmDeleteMilestone: vi.fn(),
    handleMilestoneEditSuccess: vi.fn(),
    loadingIds: { deletingItemId: "", closingItemId: "", restoringItemId: "" },
    refetchFundingEnvelope,
  } as unknown as CommunObjectivesController;
}

let queryClient: QueryClient;

function renderDialogs() {
  return render(
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider>
        <CommunMilestoneDialogs ctrl={makeCtrl()} />
      </LocalizationProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  queryClient = new QueryClient();
  refetchFundingEnvelope.mockClear();
});

describe("CommunMilestoneDialogs — la création d'un palier invalide les dépenses brutes de la fiche (H4)", () => {
  /**
   * Avant : `onCreated` ne faisait qu'un `refetchFundingEnvelope()`. Or la liste
   * des paliers est pilotée par `useCommunRawDepenses` (`[clé, answerId, étape]`),
   * que la mutation de création — sans `extraInvalidate` — ne connaît pas : le
   * palier n'apparaissait qu'au rechargement.
   */
  it("invalide le préfixe `[aac-milestone-list-depenses, answerId]` en plus de l'enveloppe", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderDialogs();

    await act(async () => {
      fireEvent.click(screen.getByText("milestone-created"));
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["aac-milestone-list-depenses", "a1"] });
    expect(refetchFundingEnvelope).toHaveBeenCalled();
  });
});
