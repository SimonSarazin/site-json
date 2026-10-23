// @vitest-environment jsdom
/**
 * `getFormData` lit un formulaire de l'hôte : par défaut le premier de l'enveloppe, sinon celui de
 * l'option `form`, et seulement sa réponse quand `form.answerId` est donné.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const fundingEnvelope = vi.fn();
const host = { id: "org-1", getEntityType: () => "organizations", fundingEnvelope };

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: host, contextId: "org-1", contextType: "organizations", me: { id: "u1" } }),
}));

const { useFundingEnvelope } = await import("./useFundingEnvelope");

function render(opts?: Parameters<typeof useFundingEnvelope>[1]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useFundingEnvelope("answer-1", opts), { wrapper });
}

/** Le second appel, `getFormData`. */
async function formDataCall() {
  await waitFor(() => expect(fundingEnvelope).toHaveBeenCalledTimes(2));
  return fundingEnvelope.mock.calls[1][0] as Record<string, unknown>;
}

beforeEach(() => {
  fundingEnvelope.mockReset();
  fundingEnvelope.mockImplementation(async (payload: { action: string }) =>
    payload.action === "getEnvelopeData"
      ? { form: { "form-recent": { name: "Autre appel" }, "form-commun": { name: "Appel du commun" } } }
      : { projects: [] },
  );
});

describe("useFundingEnvelope — formulaire lu par getFormData", () => {
  it("sans option, lit le premier formulaire de l'hôte, tous projets", async () => {
    render();

    expect(await formDataCall()).toMatchObject({
      action: "getFormData",
      formId: "form-recent",
      params: { project: "all" },
    });
  });

  it("avec `form`, lit ce formulaire et seulement cette réponse", async () => {
    render({ form: { id: "form-commun", answerId: "answer-1" } });

    expect(await formDataCall()).toMatchObject({
      action: "getFormData",
      formId: "form-commun",
      params: { answerId: "answer-1" },
    });
  });

  it("avec `form` sans réponse, lit ce formulaire, tous projets", async () => {
    render({ form: { id: "form-commun" } });

    expect(await formDataCall()).toMatchObject({ formId: "form-commun", params: { project: "all" } });
  });
});
