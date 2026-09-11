// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import i18n from "@/i18n";
import "@/modules/aac/i18n";
import en from "@/modules/aac/i18n/en.json";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";

/**
 * Même garde que pour `useAssociateExistingAacProject` : `showErrorToast`
 * affiche `error.message` tel quel — le message « contexte incomplet » doit
 * être dans la langue courante, pas une phrase française en dur.
 */

vi.mock("@/lib/toastUtils", () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));

const { showErrorToast } = await import("@/lib/toastUtils");
const { useGenerateAacProject } = await import("./useGenerateAacProject");

const wrapper = ({ children }: { children: ReactNode }) => (
  <LocalizationProvider defaultLocale="en">
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  </LocalizationProvider>
);

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

describe("useGenerateAacProject — « contexte incomplet » dans la langue courante", () => {
  it("sans API, le message levé (et affiché en description du toast) vient du bundle", async () => {
    const { result } = renderHook(
      () => useGenerateAacProject({ api: null, answerId: "answer-1", parentId: "org-1", parentType: "organizations" }),
      { wrapper },
    );

    let caught: unknown;
    await act(async () => {
      caught = await result.current.mutateAsync().catch((e: unknown) => e);
    });

    expect((caught as Error).message).toBe(en.detail.project.toasts.incompleteContext);
    expect(showErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: en.detail.project.toasts.incompleteContext }),
      "detail.project.toasts.generateError",
      expect.any(Function),
      undefined,
    );
  });
});
