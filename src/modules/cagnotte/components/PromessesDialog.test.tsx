// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici : chaque ligne, le total sélectionné et le bouton de paiement annoncent
 * le solde à régler, montant que la page de règlement facture ; l'onglet « Paiements » montre les
 * paiements, et la modale s'ouvre dessus sans promesse à régler.
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("./PledgePaymentPage", () => ({ default: () => null }));
vi.mock("./parts/CagnottePaymentsPanel", () => ({ CagnottePaymentsPanel: () => <div data-testid="paiements" /> }));

const { default: PromessesDialog } = await import("./PromessesDialog");

/** Promesse entamée : 1 000 € engagés, 600 € à régler. */
const PROMESSE = {
  id: "p1",
  financerId: "u1",
  financerName: "Alice",
  resourceId: "ans1",
  resourceName: "Commun",
  depenseIndex: 0,
  depenseName: "Palier",
  fundingAmount: 1000,
  remainingAmount: 600,
  userPledge: 0,
  userfundingPledge: [],
};

describe("PromessesDialog — montants", () => {
  it("annonce le solde à régler, pas le montant engagé", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[PROMESSE] as never[]} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Commun" }));
    fireEvent.click(screen.getByText(/CagnotteDialog\.pledges\.list\.engagement/));

    expect(screen.getByRole("button", { name: /PaySelected \(600 €\)/ })).toBeEnabled();
    expect(screen.getAllByText("600 €")).toHaveLength(2);
  });
});

describe("PromessesDialog — onglet Paiements", () => {
  it("avec des promesses, s'ouvre sur elles ; l'onglet Paiements montre les paiements", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[PROMESSE] as never[]} />);

    expect(screen.queryByTestId("paiements")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "CagnotteDialog.pledges.list.tabs.payments" }));

    expect(screen.getByTestId("paiements")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /PaySelected/ })).not.toBeInTheDocument();
  });

  it("sans promesse à régler, s'ouvre sur les paiements", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[]} />);

    expect(screen.getByTestId("paiements")).toBeInTheDocument();
  });
});
