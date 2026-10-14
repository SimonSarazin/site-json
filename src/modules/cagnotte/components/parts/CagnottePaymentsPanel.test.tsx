// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Ce qui est verrouillé ici :
 *  - « À rapprocher » montre les paiements encaissés sans enregistrement abouti, avec leur erreur ;
 *  - « Réessayer » relance l'enregistrement de la même facture (`cagnotteSettle`), jamais un paiement ;
 *  - l'historique demande toutes les factures ;
 *  - un contributeur (portée `mine`) voit ses paiements, sans colonne Payeur.
 */

const mocks = vi.hoisted(() => ({
  fundingEnvelope: null as unknown,
  aRapprocher: [] as Array<Record<string, unknown>>,
  scope: "all",
}));

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    entity: { id: "org1", fundingEnvelope: mocks.fundingEnvelope, getEntityType: () => "organizations" },
    me: { id: "u1" },
  }),
}));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toastUtils", () => ({ showSuccessToast: toasts.success, showErrorToast: toasts.error }));

const { CagnottePaymentsPanel } = await import("./CagnottePaymentsPanel");

const ECHEC = {
  id: "b1",
  created: 1760000000,
  provider: "stripe",
  amount: 50,
  status: "failed",
  error: "depense not found",
  attempts: 2,
  reference: "pi_1",
  payer: { id: "u1", name: "Alice" },
  lines: [{ kind: "contribution", answerId: "ans1", amount: 50, done: false }],
};
const REGLEE = { ...ECHEC, id: "b2", status: "settled", error: null, payer: { id: "u2", name: "Bob" } };

function afficher(aRapprocher: Array<Record<string, unknown>> = [ECHEC], scope: "all" | "mine" = "all") {
  mocks.aRapprocher = aRapprocher;
  mocks.scope = scope;
  mocks.fundingEnvelope = vi.fn(async (payload: { action: string; filter?: string }) => {
    if (payload.action === "cagnotteBills") {
      return {
        success: 1,
        scope: mocks.scope,
        bills: payload.filter === "all" ? [REGLEE, ...mocks.aRapprocher] : mocks.aRapprocher,
      };
    }
    return { success: 1, paid: true, recorded: true, inProgress: false, orderId: "pi_1", recordError: null };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CagnottePaymentsPanel />
    </QueryClientProvider>,
  );
}

const appels = (action: string) =>
  (mocks.fundingEnvelope as ReturnType<typeof vi.fn>).mock.calls.filter(([payload]) => payload.action === action);

afterEach(() => {
  vi.clearAllMocks();
});

describe("CagnottePaymentsPanel", () => {
  it("liste les paiements à rapprocher, avec leur payeur, leur statut et leur erreur", async () => {
    afficher();

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("PaymentsPanel.columns.payer")).toBeInTheDocument();
    expect(screen.getByText(/PaymentsPanel\.scope\.all/)).toBeInTheDocument();
    expect(screen.getByText("PaymentsPanel.status.unrecorded")).toBeInTheDocument();
    expect(screen.getByText("depense not found")).toBeInTheDocument();
    expect(screen.getByText("pi_1")).toBeInTheDocument();
    expect(appels("cagnotteBills")[0][0]).toMatchObject({ filter: "attention" });
  });

  it("« Réessayer » relance l'enregistrement de la même facture, puis recharge la liste", async () => {
    afficher();
    await screen.findByText("Alice");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "PaymentsPanel.retry" }));
    });

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("PaymentsPanel.toasts.recorded", expect.any(Function)));
    expect(appels("cagnotteSettle")).toHaveLength(1);
    expect(appels("cagnotteSettle")[0][0]).toMatchObject({ bill: "b1" });
    expect(appels("stripePay")).toHaveLength(0);
    await waitFor(() => expect(appels("cagnotteBills").length).toBeGreaterThan(1));
  });

  it("rien à rapprocher : message dédié, aucun bouton de reprise", async () => {
    afficher([]);

    expect(await screen.findByText("PaymentsPanel.emptyAttention")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "PaymentsPanel.retry" })).not.toBeInTheDocument();
  });

  it("l'historique demande toutes les factures ; une facture enregistrée n'a pas de reprise", async () => {
    afficher([]);
    await screen.findByText("PaymentsPanel.emptyAttention");

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "PaymentsPanel.tabs.all" }));
    });

    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(appels("cagnotteBills").some(([payload]) => payload.filter === "all")).toBe(true);
    expect(screen.queryByRole("button", { name: "PaymentsPanel.retry" })).not.toBeInTheDocument();
  });

  it("contributeur : ses paiements, sans colonne Payeur, reprise possible", async () => {
    afficher([ECHEC], "mine");

    expect(await screen.findByText("PaymentsPanel.status.unrecorded")).toBeInTheDocument();
    expect(screen.getByText(/PaymentsPanel\.scope\.mine/)).toBeInTheDocument();
    expect(screen.queryByText("PaymentsPanel.columns.payer")).not.toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PaymentsPanel.retry" })).toBeInTheDocument();
  });
});
