import { describe, expect, it } from "vitest";
import { ligneReglement, montantARegler, promessesReglables, totalARegler } from "./commande";

/**
 * Ce qui est verrouillé ici : un règlement de promesse vise la ligne par sa `finkey` (la position n'étant
 * qu'un repli) et facture son solde au centime.
 */

const FINKEY = "a-w171hEa1bvz9";

describe("règlement des promesses — lignes de commande", () => {
  const pledge = (over: Record<string, unknown> = {}) => ({
    id: "p1",
    financerId: "u1",
    resourceId: "ans1",
    resourceName: "Commun",
    depenseIndex: 0,
    depenseName: "Palier",
    fundingAmount: 1000,
    userPledge: 0,
    userfundingPledge: [],
    ...over,
  }) as never;

  it("règle le reste RÉELLEMENT dû, sur la ligne visée par sa finkey", () => {
    // Une promesse de 1000 dont 400 sont déjà validés ne doit être réglée que de 600.
    expect(ligneReglement(pledge({ finkey: FINKEY, depenseKey: "0", remainingAmount: 600 }))).toEqual({
      answerId: "ans1",
      depenseKey: "0",
      financerId: "u1",
      finkey: FINKEY,
      finIndex: undefined,
      amount: 600,
    });
  });

  it("n'utilise la position qu'à défaut de finkey (promesses antérieures)", () => {
    expect(ligneReglement(pledge({ fundingIndex: 2, depenseIndex: 3, remainingAmount: 100 }))).toMatchObject({
      depenseKey: "3",
      finkey: undefined,
      finIndex: 2,
    });
  });

  // Règles de « Payer ma promesse » : le montant facturé est celui journalisé.
  it("montantARegler : le solde d'une promesse entamée, sinon le montant engagé", () => {
    expect(montantARegler(pledge({ fundingAmount: 1000, remainingAmount: 600 }))).toBe(600);
    expect(montantARegler(pledge({ fundingAmount: 1000 }))).toBe(1000);
  });

  it("montantARegler : au centime, comme la ligne que le serveur facture", () => {
    expect(montantARegler(pledge({ remainingAmount: 0.1 + 0.2 }))).toBe(0.3);
    expect(ligneReglement(pledge({ remainingAmount: 16.666 }))).toMatchObject({ amount: 16.67 });
  });

  it("promessesReglables : écarte ce qu'un règlement ne journaliserait pas", () => {
    const reglables = promessesReglables([
      pledge({ id: "ok", remainingAmount: 600 }),
      pledge({ id: "sans-ressource", resourceId: undefined, remainingAmount: 100 }),
      pledge({ id: "soldee", remainingAmount: 0 }),
      pledge({ id: "sous-le-centime", remainingAmount: 0.004 }),
    ]);

    expect(reglables.map((p) => p.id)).toEqual(["ok"]);
  });

  it("totalARegler : somme des soldes réglables, au centime", () => {
    expect(totalARegler([
      pledge({ id: "entamee", fundingAmount: 1000, remainingAmount: 600 }),
      pledge({ id: "bruit", fundingAmount: 20, remainingAmount: 0.1 + 0.2 }),
      pledge({ id: "sans-ressource", resourceId: undefined, remainingAmount: 50 }),
    ])).toBe(600.3);
  });
});
