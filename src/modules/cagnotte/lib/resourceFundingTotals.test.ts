import { describe, expect, it } from "vitest";
import {
  computeResourceFundingTotals,
  isOpenFundableItem,
  type FundingTotalsItem,
} from "./resourceFundingTotals";

/** Item minimal : seuls `price`, `currentFunding` et `status` comptent pour les totaux. */
function item(price: number, currentFunding: number, status = "open"): FundingTotalsItem {
  return { price, currentFunding, status };
}

describe("isOpenFundableItem", () => {
  it("un statut absent vaut « ouvert »", () => {
    expect(isOpenFundableItem({ status: "" })).toBe(true);
    expect(isOpenFundableItem({ status: undefined as unknown as string })).toBe(true);
    expect(isOpenFundableItem(null)).toBe(true);
  });

  it("seul « close » ferme l'item", () => {
    expect(isOpenFundableItem({ status: "close" })).toBe(false);
    expect(isOpenFundableItem({ status: "open" })).toBe(true);
    expect(isOpenFundableItem({ status: "done" })).toBe(true);
  });
});

describe("computeResourceFundingTotals", () => {
  it("C10 — projet avec un milestone + une dépense orpheline : total et cible sur les MÊMES items", () => {
    // `resourceFinancedAmount` (= `cagnotteTotalAmount`) n'agrège que les milestones du
    // projet : 1000. La dépense orpheline (500 financés sur 500) n'y est pas, mais elle
    // est bien dans `items[]`. L'ancien court-circuit lisait total = 1000 contre une
    // cible = 2500 ⇒ reste 1500, alors que 1500 sont déjà financés.
    const milestone = item(2000, 1000);
    const orphanDepense = item(500, 500);
    const resource = { resourceTotalAmount: 2000, resourceFinancedAmount: 1000 };

    const totals = computeResourceFundingTotals([milestone, orphanDepense], resource);

    expect(totals).toEqual({ totalAmount: 1500, targetAmount: 2500, remainingAmount: 1000 });
  });

  it("l'agrégat de la ressource est ignoré dès qu'il y a des items (même s'il est plus grand)", () => {
    // Côté proposition, `totalFinancement` (backend) peut compter des dépenses closes.
    const totals = computeResourceFundingTotals(
      [item(1000, 200)],
      { resourceTotalAmount: 1000, resourceFinancedAmount: 900 },
    );

    expect(totals).toEqual({ totalAmount: 200, targetAmount: 1000, remainingAmount: 800 });
  });

  it("les items clos ne comptent ni dans le total ni dans la cible", () => {
    const totals = computeResourceFundingTotals([
      item(1000, 400),
      item(3000, 3000, "close"),
      item(500, 0, "open"),
    ]);

    expect(totals).toEqual({ totalAmount: 400, targetAmount: 1500, remainingAmount: 1100 });
  });

  it("repli sur les agrégats de la ressource UNIQUEMENT sans aucun item", () => {
    const totals = computeResourceFundingTotals([], {
      resourceTotalAmount: 4000,
      resourceFinancedAmount: 1500,
    });

    expect(totals).toEqual({ totalAmount: 1500, targetAmount: 4000, remainingAmount: 2500 });
    expect(computeResourceFundingTotals(null, { resourceTotalAmount: 300 })).toEqual({
      totalAmount: 0,
      targetAmount: 300,
      remainingAmount: 300,
    });
  });

  it("une liste ne contenant que des items clos ne retombe PAS sur l'agrégat", () => {
    // Plus rien à financer : le plafond doit être 0, pas l'agrégat backend.
    const totals = computeResourceFundingTotals([item(1000, 1000, "close")], {
      resourceTotalAmount: 1000,
      resourceFinancedAmount: 0,
    });

    expect(totals).toEqual({ totalAmount: 0, targetAmount: 0, remainingAmount: 0 });
  });

  it("sans items ni ressource → zéros (aucun NaN)", () => {
    expect(computeResourceFundingTotals(undefined, undefined)).toEqual({
      totalAmount: 0,
      targetAmount: 0,
      remainingAmount: 0,
    });
    expect(computeResourceFundingTotals(null, null)).toEqual({
      totalAmount: 0,
      targetAmount: 0,
      remainingAmount: 0,
    });
  });

  it("le reste ne descend jamais sous 0 (sur-financement)", () => {
    const totals = computeResourceFundingTotals([item(1000, 1200)]);

    expect(totals.totalAmount).toBe(1200);
    expect(totals.targetAmount).toBe(1000);
    expect(totals.remainingAmount).toBe(0);
  });

  it("montants reçus en string ou null (backend) : lus via toSafeInt, pas NaN", () => {
    const raw = [
      { price: "1 500,00", currentFunding: "250", status: "open" },
      { price: null, currentFunding: undefined, status: "open" },
    ] as unknown as FundingTotalsItem[];

    const totals = computeResourceFundingTotals(raw, {
      resourceTotalAmount: "9 999" as unknown as number,
      resourceFinancedAmount: 1,
    });

    expect(totals).toEqual({ totalAmount: 250, targetAmount: 1500, remainingAmount: 1250 });
  });

  it("ignore les entrées null/undefined dans la liste sans planter", () => {
    const totals = computeResourceFundingTotals([null, item(100, 40), undefined]);

    expect(totals).toEqual({ totalAmount: 40, targetAmount: 100, remainingAmount: 60 });
  });
});
