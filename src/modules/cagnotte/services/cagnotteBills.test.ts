import { describe, expect, it } from "vitest";
import { billStatusKey, isBillToReconcile, readCagnotteBills, type CagnotteBill } from "./cagnotteBills";

const facture = (over: Partial<CagnotteBill> = {}): CagnotteBill => ({
  id: "b1",
  created: 1760000000,
  provider: "stripe",
  amount: 50,
  status: "settled",
  error: null,
  attempts: 0,
  reference: "pi_1",
  payer: { id: "u1", name: "Alice" },
  lines: [],
  ...over,
});

describe("readCagnotteBills", () => {
  it("lit les factures de la réponse et écarte celles sans id", () => {
    const { bills } = readCagnotteBills({
      success: 1,
      bills: [
        {
          id: "b1",
          created: 1760000000,
          provider: "helloasso",
          amount: 33.5,
          status: "failed",
          error: "depense not found",
          attempts: 2,
          reference: "777",
          payer: { id: "u1", name: "Alice" },
          lines: [{ kind: "contribution", answerId: "ans1", amount: 33.5, done: false }],
        },
        { status: "settled" },
      ],
    });

    expect(bills).toEqual([
      {
        id: "b1",
        created: 1760000000,
        provider: "helloasso",
        amount: 33.5,
        status: "failed",
        error: "depense not found",
        attempts: 2,
        reference: "777",
        payer: { id: "u1", name: "Alice" },
        lines: [{ kind: "contribution", answerId: "ans1", amount: 33.5, done: false }],
      },
    ]);
  });

  it("rend une liste vide sans factures", () => {
    expect(readCagnotteBills({ success: 1 }).bills).toEqual([]);
  });

  it("portée : `mine` pour un contributeur, toute la cagnotte sinon, `scope` absent compris", () => {
    expect(readCagnotteBills({ success: 1, scope: "mine", bills: [] }).scope).toBe("mine");
    expect(readCagnotteBills({ success: 1, scope: "all", bills: [] }).scope).toBe("all");
    expect(readCagnotteBills({ success: 1, bills: [] }).scope).toBe("all");
  });
});

describe("factures à rapprocher", () => {
  it("encaissée sans enregistrement abouti : à rapprocher", () => {
    expect(isBillToReconcile(facture({ status: "failed" }))).toBe(true);
    expect(isBillToReconcile(facture({ status: "settling" }))).toBe(true);
    expect(isBillToReconcile(facture({ status: "pending", reference: "pi_1" }))).toBe(true);
    expect(billStatusKey(facture({ status: "pending", reference: "pi_1" }))).toBe("unrecorded");
  });

  it("enregistrée, en attente du paiement ou expirée : rien à rapprocher", () => {
    expect(isBillToReconcile(facture({ status: "settled" }))).toBe(false);
    expect(isBillToReconcile(facture({ status: "pending", reference: null }))).toBe(false);
    expect(isBillToReconcile(facture({ status: "expired", reference: null }))).toBe(false);
    expect(billStatusKey(facture({ status: "pending", reference: null }))).toBe("pending");
  });
});
