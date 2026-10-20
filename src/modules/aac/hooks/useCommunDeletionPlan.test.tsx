// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const SITE = { id: "site-org" };
const HOTE_ETRANGER = { id: "org-2" };
const CONTEXTE_ETRANGER = { id: "org-2", type: "organizations" };

const api = { answer: vi.fn() };
const envelopeResult = { data: undefined as unknown, isLoading: false };
const adapterResult = { savedSelectedResource: undefined as unknown };

vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ api, me: { id: "u1" } }) }));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: {} }) }));
vi.mock("@/modules/cagnotte/hooks/useCagnotteType", () => ({
  useCagnotteType: () => ({ config: { selectorType: "proposition" } }),
}));
vi.mock("@/modules/cagnotte/hooks/useCagnotteAdapter", () => ({
  useCagnotteAdapter: () => adapterResult,
}));
const useFundingEnvelope = vi.fn((_id?: string, _opts?: unknown) => envelopeResult);
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelope", () => ({
  useFundingEnvelope: (id?: string, opts?: unknown) => useFundingEnvelope(id, opts),
}));
vi.mock("./useCommunFundingContext", () => ({
  useCommunFundingContext: (answer: { form?: string } | undefined) => ({
    context: answer?.form === "form-etranger" ? CONTEXTE_ETRANGER : null,
    isLoading: false,
  }),
}));
vi.mock("./useCommunFundingHost", () => ({
  useCommunFundingHost: (context: unknown) => ({ hostEntity: context ? HOTE_ETRANGER : SITE, isLoading: false }),
}));

const { useCommunDeletionPlan } = await import("./useCommunDeletionPlan");

function render(answerId: string | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCommunDeletionPlan(answerId), { wrapper });
}

/** Document d'un commun dont la dépense porte un versement validé. */
function communPaye(form: string) {
  return {
    serverData: {
      id: "a1",
      form,
      answers: {
        aapStep1: {
          depense: [
            { poste: "Dev", price: 500, financer: [{ id: "o1", amount: 500, payment: { logs: [{ amount: 500, confirmation: "validated" }] } }] },
          ],
        },
      },
    },
  };
}

beforeEach(() => {
  api.answer.mockReset();
  useFundingEnvelope.mockClear();
  envelopeResult.data = undefined;
  envelopeResult.isLoading = false;
  adapterResult.savedSelectedResource = undefined;
});

describe("useCommunDeletionPlan", () => {
  it("au repos, ne lit rien et ne bloque rien", () => {
    const { result } = render(null);

    expect(api.answer).not.toHaveBeenCalled();
    expect(useFundingEnvelope).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ enabled: false }));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.plan.isBlocked).toBe(false);
  });

  it("lit l'enveloppe d'un commun étranger sur l'hôte de son contexte", async () => {
    api.answer.mockResolvedValue(communPaye("form-etranger"));
    render("a1");

    await waitFor(() =>
      expect(useFundingEnvelope).toHaveBeenLastCalledWith(
        "a1",
        expect.objectContaining({ hostEntity: HOTE_ETRANGER, enabled: true }),
      ),
    );
  });

  it("bloque sur un versement du document quand l'enveloppe n'a pas le commun", async () => {
    api.answer.mockResolvedValue(communPaye("form-etranger"));
    const { result } = render("a1");

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plan).toMatchObject({ isBlocked: true, paymentAmount: 500 });
  });

  it("reste en attente si le document est illisible", async () => {
    api.answer.mockRejectedValue(new Error("403"));
    const { result } = render("a1");

    await waitFor(() => expect(api.answer).toHaveBeenCalled());
    expect(result.current.isLoading).toBe(true);
    expect(useFundingEnvelope).toHaveBeenLastCalledWith("a1", expect.objectContaining({ enabled: false }));
  });
});
