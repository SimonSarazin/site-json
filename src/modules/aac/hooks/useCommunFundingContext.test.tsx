// @vitest-environment jsdom
/**
 * `formId` : le formulaire que l'enveloppe du commun doit lire — celui de sa réponse, sinon celui
 * de l'annuaire tant que la réponse n'est pas lue.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ api: null, loading: false }) }));
vi.mock("./useAacDirectoryContext", () => ({ useAacDirectoryContext: () => ({ formId: "form-annuaire" }) }));

const { useCommunFundingContext } = await import("./useCommunFundingContext");

function render(answer: { form?: string } | null) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCommunFundingContext(answer), { wrapper }).result.current;
}

describe("useCommunFundingContext — formulaire du commun", () => {
  it("prend le formulaire de la réponse", () => {
    expect(render({ form: "form-origine" }).formId).toBe("form-origine");
  });

  it("retombe sur le formulaire de l'annuaire tant que la réponse n'est pas lue", () => {
    expect(render(null).formId).toBe("form-annuaire");
  });
});
