// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), retract: vi.fn() }));

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelopeAction", () => ({ useFundingEnvelopeAction: () => mocks.submit }));
vi.mock("@/modules/cagnotte/hooks/useRetractPledge", () => ({
  useRetractPledge: () => ({ retract: mocks.retract, isPending: false }),
}));

const { RetractPledgeDialog } = await import("./RetractPledgeDialog");

const DEMANDE = {
  answerId: "ans1",
  depenseKey: "0",
  financerId: "u1",
  finkey: "a-1",
  financerName: "Alice",
  amount: 100,
  depenseName: "Palier",
};

function ouvrir() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RetractPledgeDialog request={DEMANDE} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}
const confirmer = () => screen.getByRole("button", { name: "PledgeRetract.confirm.confirm" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.retract.mockResolvedValue(true);
});

describe("RetractPledgeDialog — état frais à l'ouverture", () => {
  it("lit l'état de la promesse visée (pledgeStatus)", async () => {
    mocks.submit.mockResolvedValue({ success: 1, lock: null });
    ouvrir();

    await waitFor(() => expect(confirmer()).toBeEnabled());
    expect(mocks.submit).toHaveBeenCalledWith("pledgeStatus", { answerId: "ans1", depenseKey: "0", financerId: "u1", finkey: "a-1" });
    fireEvent.click(confirmer());
    expect(mocks.retract).toHaveBeenCalledWith(DEMANDE);
  });

  it.each([
    ["réservation d'un autre", { lock: "hold", mine: false }],
    ["facture ouverte, même la sienne", { lock: "bill", mine: true }],
  ])("%s : avertissement, confirmation désactivée", async (_label, status) => {
    mocks.submit.mockResolvedValue({ success: 1, until: 1_900_000_000, ...status });
    ouvrir();

    expect(await screen.findByRole("alert")).toHaveTextContent("PledgeRetract.confirm.locked");
    expect(confirmer()).toBeDisabled();
  });

  it("sa propre réservation bloque aussi : il faut d'abord la décocher", async () => {
    mocks.submit.mockResolvedValue({ success: 1, lock: "hold", mine: true, until: 1_900_000_000 });
    ouvrir();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(confirmer()).toBeDisabled();
  });

  it.each([
    ["échéance passée (facture à rapprocher)", { until: 1_000_000_000 }],
    ["échéance absente", {}],
  ])("%s : avertissement sans heure, confirmation désactivée", async (_label, status) => {
    mocks.submit.mockResolvedValue({ success: 1, lock: "bill", mine: false, ...status });
    ouvrir();

    expect(await screen.findByRole("alert")).toHaveTextContent("PledgeRetract.inProgressHint");
    expect(confirmer()).toBeDisabled();
  });

  it("état illisible (erreur réseau) : le serveur tranchera au retrait", async () => {
    mocks.submit.mockRejectedValue(new Error("hors ligne"));
    ouvrir();

    await waitFor(() => expect(confirmer()).toBeEnabled());
  });
});
