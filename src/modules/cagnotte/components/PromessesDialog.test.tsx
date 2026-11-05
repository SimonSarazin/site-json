// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici : chaque ligne, le total sélectionné et le bouton de paiement annoncent
 * le solde à régler, montant que la page de règlement facture ; l'onglet « Paiements » montre les
 * paiements, et la modale s'ouvre dessus sans promesse à régler.
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("./PledgePaymentPage", () => ({ default: () => null }));
vi.mock("./parts/CagnottePaymentsPanel", () => ({ CagnottePaymentsPanel: () => <div data-testid="paiements" /> }));

const retraction = vi.hoisted(() => ({ enabled: false }));
/** Arguments du dernier rendu du hook de réservation : la sélection transmise et le rappel des refus. */
const hold = vi.hoisted(() => ({
  last: null as null | { enabled: boolean; open: boolean; selected: Array<{ id: string }>; onRefused: (refusals: Map<string, string>) => void },
  flush: vi.fn(async () => undefined),
}));
vi.mock("@/modules/cagnotte/hooks/usePledgeSelectionHold", () => ({
  usePledgeSelectionHold: (args: NonNullable<typeof hold.last>) => {
    hold.last = args;
    return { flush: hold.flush };
  },
}));
/** Paiements en cours relus pendant que la modale est ouverte (`undefined` : pas encore de réponse). */
const live = vi.hoisted(() => ({ data: undefined as unknown, last: null as null | { ids: string[]; enabled?: boolean } }));
vi.mock("@/modules/cagnotte/hooks/usePledgesInProgress", () => ({
  usePledgesInProgress: (ids: string[], opts?: { enabled?: boolean }) => {
    live.last = { ids: [...ids], enabled: opts?.enabled };
    return live.data;
  },
}));
vi.mock("@/modules/cagnotte/hooks/usePledgeRetractionEnabled", () => ({ usePledgeRetractionEnabled: () => retraction.enabled }));
/** Le dialogue réel appelle le serveur : ici, « confirmer » joue directement son succès. */
vi.mock("./parts/RetractPledgeDialog", () => ({
  RetractPledgeDialog: ({ request, onClose, onRetracted }: { request: Record<string, unknown> | null; onClose: () => void; onRetracted?: () => void }) =>
    request ? (
      <div data-testid="confirmation" data-request={JSON.stringify(request)}>
        <button type="button" onClick={() => { onRetracted?.(); onClose(); }}>confirmer</button>
      </div>
    ) : null,
}));

const { default: PromessesDialog } = await import("./PromessesDialog");

beforeEach(() => {
  live.data = undefined;
  hold.flush.mockClear();
});

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

describe("PromessesDialog — retrait d'une promesse", () => {
  const RETIRABLE = { ...PROMESSE, id: "p2", finkey: "a-2", depenseKey: "3", remainingAmount: 1000, retractable: true };
  const retirer = () => screen.queryAllByRole("button", { name: "PledgeRetract.aria" });
  const ouvrirGroupe = () => fireEvent.click(screen.getByText(/CagnotteDialog\.pledges\.list\.engagement/));

  beforeEach(() => {
    retraction.enabled = true;
  });

  it("clé du site désactivée : aucun bouton", () => {
    retraction.enabled = false;
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[RETIRABLE] as never[]} />);
    ouvrirGroupe();

    expect(retirer()).toHaveLength(0);
  });

  it("seule une promesse retirable porte le bouton", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[PROMESSE, RETIRABLE] as never[]} />);
    ouvrirGroupe();

    expect(retirer()).toHaveLength(1);
  });

  it("vise la ligne par sa finkey et la clé de sa dépense, puis la retire de la liste", async () => {
    const onRetracted = vi.fn();
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[RETIRABLE] as never[]} onRetracted={onRetracted} />);
    ouvrirGroupe();

    fireEvent.click(retirer()[0]);
    const request = JSON.parse((await screen.findByTestId("confirmation")).getAttribute("data-request") ?? "{}");
    expect(request).toMatchObject({ answerId: "ans1", depenseKey: "3", financerId: "u1", finkey: "a-2", amount: 1000 });

    fireEvent.click(screen.getByRole("button", { name: "confirmer" }));
    expect(onRetracted).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Palier")).not.toBeInTheDocument();
    expect(screen.getByText("CagnotteDialog.pledges.list.noPledges")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PaySelected \(0 €\)/ })).toBeDisabled();
  });

  it("une ligne cochée est en cours de paiement : pas de « Retirer » tant qu'elle reste cochée", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[RETIRABLE] as never[]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Commun" }));
    ouvrirGroupe();
    expect(screen.getByRole("button", { name: /PaySelected \(1\s000 €\)/ })).toBeEnabled();
    expect(retirer()).toHaveLength(0);

    fireEvent.click(screen.getByRole("checkbox", { name: "Commun" }));
    expect(retirer()).toHaveLength(1);
  });

  it("la sélection en attente part avant la confirmation, qui relit l'état de la promesse", async () => {
    let release: () => void = () => undefined;
    hold.flush.mockImplementationOnce(() => new Promise<undefined>((resolve) => { release = () => resolve(undefined); }));
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[RETIRABLE] as never[]} />);
    ouvrirGroupe();
    fireEvent.click(retirer()[0]);

    expect(hold.flush).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("confirmation")).not.toBeInTheDocument();
    await act(async () => release());
    expect(await screen.findByTestId("confirmation")).toBeInTheDocument();
  });

  it("paiement en cours : signalé sur la ligne, sans bouton", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[{ ...RETIRABLE, paymentInProgress: true }] as never[]} />);
    ouvrirGroupe();

    expect(screen.getByText("PledgeRetract.inProgress")).toBeInTheDocument();
    expect(retirer()).toHaveLength(0);
  });

  it("clé désactivée : pas de signalement non plus", () => {
    retraction.enabled = false;
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[{ ...RETIRABLE, paymentInProgress: true }] as never[]} />);
    ouvrirGroupe();

    expect(screen.queryByText("PledgeRetract.inProgress")).not.toBeInTheDocument();
  });

  it("sans clé de dépense, la position de la dépense en tient lieu", async () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[{ ...RETIRABLE, depenseKey: undefined, depenseIndex: 2 }] as never[]} />);
    ouvrirGroupe();
    fireEvent.click(retirer()[0]);

    expect(JSON.parse((await screen.findByTestId("confirmation")).getAttribute("data-request") ?? "{}").depenseKey).toBe("2");
  });
});

describe("PromessesDialog — réservation dès la sélection", () => {
  const A = { ...PROMESSE, id: "pa", finkey: "a-a", remainingAmount: 100, retractable: true };
  const B = { ...PROMESSE, id: "pb", finkey: "a-b", depenseName: "Autre palier", remainingAmount: 200, retractable: true };
  const ouvrirGroupe = () => fireEvent.click(screen.getByText(/CagnotteDialog\.pledges\.list\.engagement/));
  const caseDe = (depense: string) => screen.getByText(depense).closest("label")?.querySelector("input") as HTMLInputElement;

  beforeEach(() => {
    retraction.enabled = true;
    hold.last = null;
  });

  it("transmet les promesses cochées au hook de réservation, modale ouverte", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[A, B] as never[]} />);
    ouvrirGroupe();
    fireEvent.click(caseDe("Palier"));

    expect(hold.last?.enabled).toBe(true);
    expect(hold.last?.open).toBe(true);
    expect(hold.last?.selected.map((p) => p.id)).toEqual(["pa"]);
  });

  it("réservation refusée (paiement d'un autre) : décochée, case désactivée, pastille, hors total", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[A, B] as never[]} />);
    ouvrirGroupe();
    fireEvent.click(caseDe("Palier"));
    fireEvent.click(caseDe("Autre palier"));
    act(() => hold.last?.onRefused(new Map([["a-a", "heldByOther"]])));

    expect(caseDe("Palier").checked).toBe(false);
    expect(caseDe("Palier").disabled).toBe(true);
    expect(screen.getByText("PledgeRetract.inProgress")).toBeInTheDocument();
    expect(hold.last?.selected.map((p) => p.id)).toEqual(["pb"]);
    expect(screen.getByRole("button", { name: /PaySelected \(200 €\)/ })).toBeEnabled();
  });

  it("réservation refusée faute de droits : case désactivée, pastille « Non autorisée », hors total", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[A, B] as never[]} />);
    ouvrirGroupe();
    fireEvent.click(caseDe("Palier"));
    fireEvent.click(caseDe("Autre palier"));
    act(() => hold.last?.onRefused(new Map([["a-a", "notAllowed"]])));

    expect(caseDe("Palier").disabled).toBe(true);
    expect(screen.getByText("PledgeRetract.notAllowed")).toHaveAttribute("title", "PledgeRetract.notAllowedHint");
    expect(screen.getByRole("button", { name: /PaySelected \(200 €\)/ })).toBeEnabled();
  });

  it("promesse retirée entre-temps : pastille « Promesse retirée »", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[A] as never[]} />);
    ouvrirGroupe();
    fireEvent.click(caseDe("Palier"));
    act(() => hold.last?.onRefused(new Map([["a-a", "retracted"]])));

    expect(screen.getByText("PledgeRetract.retracted")).toBeInTheDocument();
    expect(caseDe("Palier").disabled).toBe(true);
  });

  it("paiement en cours annoncé par l'enveloppe : case désactivée, ignorée par « tout cocher »", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[{ ...A, paymentInProgress: true }, B] as never[]} />);
    ouvrirGroupe();
    fireEvent.click(screen.getByRole("checkbox", { name: "Commun" }));

    expect(caseDe("Palier").disabled).toBe(true);
    expect(hold.last?.selected.map((p) => p.id)).toEqual(["pb"]);
  });

  it("clé désactivée : ni réservation active, ni case désactivée", () => {
    retraction.enabled = false;
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[{ ...A, paymentInProgress: true }] as never[]} />);
    ouvrirGroupe();

    expect(hold.last?.enabled).toBe(false);
    expect(caseDe("Palier").disabled).toBe(false);
  });
});

describe("PromessesDialog — paiements en cours relus", () => {
  const A = { ...PROMESSE, id: "pa", finkey: "a-a", remainingAmount: 100, retractable: true };
  const B = { ...PROMESSE, id: "pb", finkey: "a-b", depenseName: "Autre palier", remainingAmount: 200, retractable: true };
  const ouvrirGroupe = () => fireEvent.click(screen.getByText(/CagnotteDialog\.pledges\.list\.engagement/));
  const caseDe = (depense: string) => screen.getByText(depense).closest("label")?.querySelector("input") as HTMLInputElement;

  beforeEach(() => {
    retraction.enabled = true;
    hold.last = null;
  });

  it("relit les réponses des promesses tant que la modale est ouverte", () => {
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[A, B] as never[]} />);

    expect(live.last).toEqual({ ids: ["ans1", "ans1"], enabled: true });
  });

  it("réservée par un autre onglet ou un autre compte : désactivée ; réservée par cet onglet : cochable", () => {
    live.data = {
      paymentsInProgress: {
        ans1: { pledges: [{ finkey: "a-a", kind: "hold", mine: false }, { finkey: "a-b", kind: "hold", mine: true }], depenses: [] },
      },
    };
    render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[A, B] as never[]} />);
    ouvrirGroupe();

    expect(caseDe("Palier").disabled).toBe(true);
    expect(screen.getByText("PledgeRetract.inProgress")).toBeInTheDocument();
    fireEvent.click(caseDe("Autre palier"));
    expect(caseDe("Autre palier").checked).toBe(true);
    expect(hold.last?.selected.map((p) => p.id)).toEqual(["pb"]);
  });

  it("une fois relus, ils remplacent ce que l'hôte avait lu dans l'enveloppe", async () => {
    const { rerender } = render(<PromessesDialog open onOpenChange={vi.fn()} pledges={[{ ...A, paymentInProgress: true }] as never[]} />);
    ouvrirGroupe();
    expect(caseDe("Palier").disabled).toBe(true);

    live.data = { paymentsInProgress: [] };
    rerender(<PromessesDialog open onOpenChange={vi.fn()} pledges={[{ ...A, paymentInProgress: true }] as never[]} />);
    await waitFor(() => expect(caseDe("Palier").disabled).toBe(false));
  });
});
