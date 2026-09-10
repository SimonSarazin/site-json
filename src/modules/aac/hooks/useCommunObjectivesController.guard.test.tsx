// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import "@/modules/cagnotte/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { showErrorToast } from "@/lib/toastUtils";
import type { CoFormAnswer } from "@/modules/coform/types";
import type { CagnotteResource, FundingAction } from "@/modules/cagnotte/types";

/**
 * M41 (review MR 53) : sur la fiche commun, l'auteur d'une action voit
 * « Terminer » et « Supprimer » même quand l'entité `Project` n'est pas résolue
 * (`useCommunProjectEntity` rend `null` en cas d'échec, mis en cache 2 min) — les
 * droits d'action ne dépendent pas d'elle, à raison. Mais les mutations l'exigent
 * (`ctx.project`), et `handleActionDone` / `requestDeleteAction` /
 * `handleActionCandidate` partaient sans la vérifier : mutation lancée, échec
 * immédiat sur `milestone.errors.projectMissing`, toast d'erreur générique. Seul
 * `handleActionEdit` se protégeait (`resolveProjectEntityForModal`).
 *
 * Les trois handlers passent désormais par `requireProjectEntity` AVANT `mutate()`.
 */

const mocks = vi.hoisted(() => ({
  projectEntity: null as unknown,
  markDone: vi.fn(),
  deleteAction: vi.fn(),
  candidate: vi.fn(),
}));

vi.mock("@/lib/toastUtils", () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    api: {},
    apiClient: {},
    me: { id: "auteur", isConnected: true, serverData: { id: "auteur" } },
  }),
}));
vi.mock("@/modules/profil/hooks/useProfileEntity", () => ({ useOptionalProfileEntity: () => null }));
vi.mock("@/modules/aac/hooks/useCommunFundingContext", () => ({ useCommunFundingContext: () => ({ context: null }) }));
vi.mock("@/modules/aac/hooks/useCommunFundingHost", () => ({
  useCommunFundingHost: () => ({ hostEntity: null, isLoading: false }),
}));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelope", () => ({
  useFundingEnvelope: () => ({ data: undefined, refetch: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("@/modules/aac/hooks/useCommunProjectEntity", () => ({
  useCommunProjectEntity: () => mocks.projectEntity,
}));
vi.mock("@/modules/aac/hooks/useCommunRawDepenses", () => ({
  useCommunRawDepensesDocument: () => ({ data: undefined }),
  COMMUN_RAW_DEPENSES_QUERY_KEY: "aac-milestone-list-depenses",
}));
vi.mock("@/modules/cagnotte/hooks/useCagnottePermissions", () => ({
  useCagnottePermissions: () => ({ isConnected: true, currentUserId: "auteur" }),
}));
const mutationInerte = () => ({ mutate: vi.fn(), isPending: false });
vi.mock("@/modules/cagnotte/actions/mutations", () => ({
  useCandidateAction: () => ({ mutate: mocks.candidate, isPending: false }),
  useMarkActionDone: () => ({ mutate: mocks.markDone, isPending: false }),
  useDeleteAction: () => ({ mutate: mocks.deleteAction, isPending: false }),
  useEditMilestone: mutationInerte,
  useCloseMilestone: mutationInerte,
  useDeleteMilestone: mutationInerte,
  useRestoreMilestone: mutationInerte,
}));

const { useCommunObjectivesController } = await import("./useCommunObjectivesController");

const ANSWER = { userId: "auteur" } as unknown as CoFormAnswer;
const FUNDING = { id: "answer-1", answerId: "answer-1", projectId: "proj-1", items: [] } as unknown as CagnotteResource;
const ACTION = { id: "a1", name: "Maquettes", status: "todo" } as unknown as FundingAction;

// Le contrôleur lit `useQueryClient()` (invalidation du cache brut des dépenses, lot 2) :
// un QueryClient sans retry suffit, aucune requête ne part dans ces tests.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <LocalizationProvider>{children}</LocalizationProvider>
  </QueryClientProvider>
);

function monter(funding: CagnotteResource = FUNDING) {
  return renderHook(() => useCommunObjectivesController({ answerQuery: ANSWER, funding }), { wrapper });
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

beforeEach(() => {
  mocks.projectEntity = null;
  vi.clearAllMocks();
});

describe("useCommunObjectivesController — entité projet absente (M41)", () => {
  it("« Terminer » ne lance pas la mutation et explique pourquoi", () => {
    const { result } = monter();

    act(() => result.current.handleActionDone("m1", ACTION));

    expect(mocks.markDone).not.toHaveBeenCalled();
    expect(showErrorToast).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showErrorToast).mock.calls[0][1]).toBe("ActionsSection.toasts.actionCompleteFailed.title");
  });

  it("« Supprimer » n'ouvre pas la confirmation", () => {
    const { result } = monter();

    act(() => result.current.handleActionDelete("m1", ACTION));

    expect(result.current.pendingDeleteAction).toBeNull();
    expect(mocks.deleteAction).not.toHaveBeenCalled();
    expect(vi.mocked(showErrorToast).mock.calls[0][1]).toBe("ActionsSection.toasts.actionDeleteFailed.title");
  });

  it("« Candidater » ne lance pas la mutation", () => {
    const { result } = monter();

    act(() => result.current.handleActionCandidate("m1", ACTION));

    expect(mocks.candidate).not.toHaveBeenCalled();
    expect(vi.mocked(showErrorToast).mock.calls[0][1]).toBe("ActionsSection.toasts.candidateFailed.title");
  });

  it("TÉMOIN : entité résolue, les trois gestes partent", () => {
    mocks.projectEntity = { id: "proj-1", serverData: {} };
    const { result } = monter();

    act(() => result.current.handleActionDone("m1", ACTION));
    act(() => result.current.handleActionCandidate("m1", ACTION));
    act(() => result.current.handleActionDelete("m1", ACTION));

    expect(mocks.markDone).toHaveBeenCalledWith({ actionId: "a1", name: "Maquettes" }, expect.anything());
    expect(mocks.candidate).toHaveBeenCalledWith({ actionId: "a1" }, expect.anything());
    expect(result.current.pendingDeleteAction).toEqual({ milestoneId: "m1", action: ACTION });
    expect(showErrorToast).not.toHaveBeenCalled();
  });
});
