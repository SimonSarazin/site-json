// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Api } from "@communecter/cocolight-api-client";
import i18n from "@/i18n";
import "@/modules/aac/i18n";
import en from "@/modules/aac/i18n/en.json";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";

/**
 * Ce que ces tests protègent : la DESCRIPTION du toast d'échec est dans la
 * langue courante.
 *
 * `useMutationWithToast.onError` → `showErrorToast(error, key, t)` place
 * `error.message` tel quel en description. Une erreur levée avec une phrase
 * française en dur (celle de la lib, ou celle du garde « contexte incomplet »)
 * s'affichait donc en français sous un titre traduit en anglais.
 */

vi.mock("@/lib/toastUtils", () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));
vi.mock("@/modules/aac/lib/associateExistingProject", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/aac/lib/associateExistingProject")>();
  return { ...actual, associateExistingProject: vi.fn() };
});

const { associateExistingProject, ProjectAlreadyLinkedError } = await import(
  "@/modules/aac/lib/associateExistingProject"
);
const { showErrorToast } = await import("@/lib/toastUtils");
const { useAssociateExistingAacProject } = await import("./useAssociateExistingAacProject");

const wrapper = ({ children }: { children: ReactNode }) => (
  <LocalizationProvider defaultLocale="en">
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  </LocalizationProvider>
);

const api = {
  answer: vi.fn().mockResolvedValue({ id: "answer-1" }),
  project: vi.fn().mockResolvedValue({ id: "proj-1" }),
} as unknown as Api;

async function mutate(hook: ReturnType<typeof useAssociateExistingAacProject>): Promise<unknown> {
  let caught: unknown;
  await act(async () => {
    caught = await hook.mutateAsync({ projectId: "proj-1" }).catch((e: unknown) => e);
  });
  return caught;
}

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAssociateExistingAacProject — messages d'erreur dans la langue courante", () => {
  it("« projet déjà rattaché » : la description vient du bundle, pas de la phrase de la lib", async () => {
    vi.mocked(associateExistingProject).mockRejectedValueOnce(
      new ProjectAlreadyLinkedError("answer-42", "project-data"),
    );
    const { result } = renderHook(
      () => useAssociateExistingAacProject({ api, answerId: "answer-1", userId: "user-1" }),
      { wrapper },
    );

    const error = await mutate(result.current);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(en.detail.project.toasts.alreadyLinked);
    expect(showErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: en.detail.project.toasts.alreadyLinked }),
      "detail.project.toasts.associateError",
      expect.any(Function),
      undefined,
    );
  });

  it("« contexte incomplet » : message traduit, jamais la phrase française en dur", async () => {
    const { result } = renderHook(
      () => useAssociateExistingAacProject({ api: null, answerId: "answer-1", userId: "user-1" }),
      { wrapper },
    );

    const error = await mutate(result.current);

    expect((error as Error).message).toBe(en.detail.project.toasts.incompleteContext);
    expect(associateExistingProject).not.toHaveBeenCalled();
  });

  it("une erreur étrangère à la lib (réseau, SDK) remonte telle quelle", async () => {
    vi.mocked(associateExistingProject).mockRejectedValueOnce(new Error("HTTP 500"));
    const { result } = renderHook(
      () => useAssociateExistingAacProject({ api, answerId: "answer-1", userId: "user-1" }),
      { wrapper },
    );

    const error = await mutate(result.current);

    expect((error as Error).message).toBe("HTTP 500");
  });
});
