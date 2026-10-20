// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ApiClient, Project } from "@communecter/cocolight-api-client";
import i18n from "@/i18n";
import "@/modules/cagnotte/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { showErrorToast } from "@/lib/toastUtils";
import { useActionGuards, type ActionGuardContext } from "./useActionGuards";

vi.mock("@/lib/toastUtils", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => <LocalizationProvider>{children}</LocalizationProvider>;

function monter(ctx: Partial<ActionGuardContext>) {
  return renderHook(
    () =>
      useActionGuards({
        isConnected: true,
        apiClient: {} as ApiClient,
        projectId: "proj-1",
        answerId: "answer-1",
        ...ctx,
      }),
    { wrapper },
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * M41 (review MR 53) : les mutations d'action (`useMarkActionDone`,
 * `useDeleteAction`, `useCandidateAction`) exigent l'entité `Project` du SDK et
 * lèvent `milestone.errors.projectMissing` sans elle. Or les droits d'action
 * (auteur, contributeur assigné) ne dépendent pas de l'entité, à raison : sur la
 * fiche commun elle est résolue de façon asynchrone, et reste `null` quand la
 * résolution échoue. `requireApiAacContext` ne teste que `apiClient` et `answerId`.
 * Il manquait un garde qui dise, AVANT `mutate()`, que l'entité manque — au lieu
 * d'une mutation vouée à l'échec et d'un toast d'erreur générique.
 */
describe("useActionGuards.requireProjectEntity", () => {
  it("passe quand l'entité du projet lié est en main", () => {
    const { result } = monter({ project: { id: "proj-1" } as unknown as Project });

    expect(result.current.requireProjectEntity("actionCompleteFailed")).toBe(true);
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("passe sans projet lié : un palier answer-only n'a pas d'entité à exiger", () => {
    const { result } = monter({ projectId: "", project: null });

    expect(result.current.requireProjectEntity("actionCompleteFailed")).toBe(true);
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("refuse quand un projet est lié mais que son entité manque, avec le titre du geste et le motif", () => {
    const { result } = monter({ projectId: "proj-1", project: null });

    expect(result.current.requireProjectEntity("actionCompleteFailed")).toBe(false);

    expect(showErrorToast).toHaveBeenCalledTimes(1);
    const [error, titleKey] = vi.mocked(showErrorToast).mock.calls[0];
    expect(titleKey).toBe("ActionsSection.toasts.actionCompleteFailed.title");
    expect((error as Error).message).toBe(i18n.t("milestone.errors.projectMissing", { ns: "modules/cagnotte" }));
    // Le motif est bien traduit, pas une clé brute.
    expect((error as Error).message).not.toBe("milestone.errors.projectMissing");
  });

  it("une entité absente (`undefined`, contexte historique sans le champ) refuse aussi dès qu'un projet est lié", () => {
    const { result } = monter({ projectId: "proj-1" });

    expect(result.current.requireProjectEntity("actionDeleteFailed")).toBe(false);
    expect(vi.mocked(showErrorToast).mock.calls[0][1]).toBe("ActionsSection.toasts.actionDeleteFailed.title");
  });

  it("TÉMOIN : `requireApiAacContext` ne voit pas l'entité manquante — c'est bien un garde à part", () => {
    const { result } = monter({ projectId: "proj-1", project: null });

    expect(result.current.requireApiAacContext("actionCompleteFailed")).toBe(true);
    expect(showErrorToast).not.toHaveBeenCalled();
  });
});
