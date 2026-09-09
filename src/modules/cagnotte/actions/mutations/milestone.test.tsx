// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Api } from "@communecter/cocolight-api-client";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { appendAnswerDepense, appendProjectMilestone } from "@/modules/cagnotte/lib/actionMilestonePathUpdates";
import { useCreateMilestone } from "./milestone";

vi.mock("@/lib/toastUtils", () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));
vi.mock("@/modules/cagnotte/lib/actionMilestonePathUpdates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/cagnotte/lib/actionMilestonePathUpdates")>()),
  appendProjectMilestone: vi.fn().mockResolvedValue(undefined),
  appendAnswerDepense: vi.fn().mockResolvedValue(undefined),
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <LocalizationProvider>{children}</LocalizationProvider>
    </QueryClientProvider>
  );
}

function apiMock() {
  const answerEntity = { id: "answer-1" };
  const projectEntity = { id: "proj-1" };
  return {
    api: {
      answer: vi.fn().mockResolvedValue(answerEntity),
      project: vi.fn().mockResolvedValue(projectEntity),
    } as unknown as Api,
    answerEntity,
    projectEntity,
  };
}

const PARAMS = {
  milestoneId: "m-new",
  name: "Prototype",
  description: "Une première version testable",
  targetAmount: 1200,
  userId: "u1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * H22 (résiduel §11.6) : asymétrie création/édition. L'édition écrit `description`
 * sur la dépense (b3ab0d9b), la création ne l'écrivait que sur le palier projet —
 * or c'est `depense.description` que relisent la fiche et la modale. Un palier
 * CRÉÉ avec projet lié n'avait donc pas de description visible.
 */
describe("useCreateMilestone — la description part sur la dépense (H22)", () => {
  it("avec projet lié : description écrite sur la dépense ET sur le palier projet", async () => {
    const { api, answerEntity, projectEntity } = apiMock();
    const { result } = renderHook(
      () => useCreateMilestone({ api, rawEnvelope: null, projectId: "proj-1", answerId: "answer-1" }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync(PARAMS);
    });

    expect(appendAnswerDepense).toHaveBeenCalledWith({
      answer: answerEntity,
      depense: expect.objectContaining({
        poste: "Prototype",
        description: "Une première version testable",
        price: 1200,
        milestone: "m-new",
        user: "u1",
      }),
    });
    expect(appendProjectMilestone).toHaveBeenCalledWith({
      project: projectEntity,
      milestone: { milestoneId: "m-new", name: "Prototype", description: "Une première version testable", status: "open" },
    });
  });

  it("sans projet lié : la dépense porte la description, rien côté projet", async () => {
    const { api, answerEntity } = apiMock();
    const { result } = renderHook(
      () => useCreateMilestone({ api, rawEnvelope: null, projectId: "", answerId: "answer-1" }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync(PARAMS);
    });

    expect(appendAnswerDepense).toHaveBeenCalledWith({
      answer: answerEntity,
      depense: expect.objectContaining({ description: "Une première version testable" }),
    });
    expect(appendProjectMilestone).not.toHaveBeenCalled();
  });
});
