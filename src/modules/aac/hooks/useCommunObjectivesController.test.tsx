// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { CoFormAnswer } from "@/modules/coform/types";
import type { CagnotteResource } from "@/modules/cagnotte/types";

/**
 * M7 : `resolveProjectEntityForModal` résout bien une entité `Project` quand le
 * cache n'en a pas — mais ses appelants n'en faisaient qu'un booléen, et les
 * modales recevaient `ctrl.projectEntity` / `ctrl.actionCtx.project`, c'est-à-dire
 * la valeur de `useCommunProjectEntity`. Or celui-ci AVALE les erreurs et met
 * `null` en cache deux minutes : la modale s'ouvrait sur un projet nul, et la
 * mutation levait `projectMissing` une fois la saisie faite.
 *
 * `useCommunProjectEntity` est RÉEL ici (React Query) ; tout ce qui n'est pas la
 * résolution du projet — droits, gardes, enveloppe, mutations — est mocké.
 */

const mocks = vi.hoisted(() => ({
  meProject: vi.fn<(args: { id: string }) => Promise<unknown>>(),
}));

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    api: null,
    apiClient: {},
    me: { id: "u1", serverData: { id: "u1" }, project: mocks.meProject },
  }),
}));
vi.mock("@/modules/profil/hooks/useProfileEntity", () => ({
  useOptionalProfileEntity: () => null,
}));
vi.mock("@/modules/cagnotte/hooks/useCagnottePermissions", () => ({
  useCagnottePermissions: () => ({ isConnected: true, currentUserId: "u1" }),
}));
vi.mock("@/modules/cagnotte/hooks/useActionGuards", () => ({
  useActionGuards: () => ({
    requireConnected: () => true,
    requireApiAacContext: () => true,
    requireApiContext: () => true,
  }),
}));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelope", () => ({
  useFundingEnvelope: () => ({ data: undefined, refetch: vi.fn() }),
}));
vi.mock("@/modules/cagnotte/actions/mutations", () => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false });
  return {
    useCandidateAction: mutation,
    useMarkActionDone: mutation,
    useDeleteAction: mutation,
    useDeleteMilestone: mutation,
    useEditMilestone: mutation,
    useCloseMilestone: mutation,
    useRestoreMilestone: mutation,
  };
});
vi.mock("@/modules/aac/hooks/useCommunFundingContext", () => ({
  useCommunFundingContext: () => ({ context: null }),
}));
vi.mock("@/modules/aac/hooks/useCommunFundingHost", () => ({
  useCommunFundingHost: () => ({ hostEntity: null, isLoading: false }),
}));
vi.mock("@/modules/aac/hooks/useCommunRawDepenses", () => ({
  COMMUN_RAW_DEPENSES_QUERY_KEY: "aac-milestone-list-depenses",
  useCommunRawDepensesDocument: () => ({ data: undefined }),
}));

const { useCommunObjectivesController } = await import("./useCommunObjectivesController");
const { AAC_QUERY_KEYS } = await import("../constants/queryKeys");

const PROJECT_ID = "proj-1";
const PROJECT_KEY = AAC_QUERY_KEYS.COMMUN_PROJECT(PROJECT_ID, "u1");

function makeProject() {
  return {
    id: PROJECT_ID,
    serverData: { id: PROJECT_ID, oceco: { milestones: [] } },
    refresh: vi.fn().mockResolvedValue(undefined),
    action: vi.fn(),
  };
}

function renderController() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(LocalizationProvider, null, children)
    );
  const hook = renderHook(
    () =>
      useCommunObjectivesController({
        answerQuery: { id: "answer-1", userId: "u1" } as unknown as CoFormAnswer,
        funding: { projectId: PROJECT_ID, answerId: "answer-1", items: [] } as unknown as CagnotteResource,
      }),
    { wrapper }
  );
  return { ...hook, queryClient };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.meProject.mockReset();
});

describe("useCommunObjectivesController — projet résolu pour la modale (M7)", () => {
  it("l'entité résolue à l'ouverture de la modale SERT la modale, elle n'est pas jetée", async () => {
    const project = makeProject();
    // Le déclencheur du rapport : `me.project` échoue UNE fois (500/timeout) —
    // `useCommunProjectEntity` avale l'erreur et met `null` en cache — puis réussit.
    mocks.meProject.mockRejectedValueOnce(new Error("500")).mockResolvedValue(project);

    const { result, queryClient } = renderController();

    await waitFor(() => expect(queryClient.getQueryState(PROJECT_KEY)?.status).toBe("success"));
    expect(mocks.meProject).toHaveBeenCalledTimes(1);
    expect(result.current.projectEntity).toBeNull();
    expect(result.current.actionCtx.project).toBeNull();

    // « Ajouter une action » : la résolution est refaite et réussit.
    await act(async () => {
      result.current.handleCreateAction("m1", "Palier 1");
    });
    await waitFor(() => expect(result.current.isCreateActionOpen).toBe(true));

    expect(mocks.meProject).toHaveBeenCalledTimes(2);
    expect(mocks.meProject).toHaveBeenLastCalledWith({ id: PROJECT_ID });
    // Ce que reçoivent `ActionCreateDialog` et `useCreateAction` :
    expect(result.current.projectEntity).toBe(project);
    expect(result.current.actionCtx.project).toBe(project);
    expect(queryClient.getQueryData(PROJECT_KEY)).toBe(project);
  });

  it("témoin — quand le cache porte déjà l'entité, elle est rafraîchie sur place, sans nouvelle résolution", async () => {
    const project = makeProject();
    mocks.meProject.mockResolvedValue(project);

    const { result } = renderController();
    await waitFor(() => expect(result.current.projectEntity).toBe(project));

    await act(async () => {
      result.current.handleCreateAction("m1", "Palier 1");
    });
    await waitFor(() => expect(result.current.isCreateActionOpen).toBe(true));

    expect(mocks.meProject).toHaveBeenCalledTimes(1);
    expect(project.refresh).toHaveBeenCalledTimes(1);
    expect(result.current.actionCtx.project).toBe(project);
  });
});
