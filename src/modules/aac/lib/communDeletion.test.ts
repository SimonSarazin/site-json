import { describe, it, expect } from "vitest";
import { resolveCommunDeletionPlan } from "./communDeletion";
import type { CagnotteResource, CagnotteFundableItem } from "@/modules/cagnotte/types";

/**
 * Cette fonction décide d'INTERDIRE une suppression. Ce qui est verrouillé ici,
 * c'est surtout ce qui ne doit PAS passer à travers le filet : de l'argent
 * enregistré sur un palier clôturé, ou remonté par le chemin de repli brut.
 */

function item(over: Partial<CagnotteFundableItem> = {}): CagnotteFundableItem {
  return {
    fromType: "depense",
    itemId: "i1",
    milestoneId: "m1",
    depenseIndex: 0,
    name: "Développement",
    price: 1000,
    status: "open",
    actions: [],
    funding: [],
    currentFunding: 0,
    unpaidFunding: 0,
    userPledge: 0,
    allFunding: [],
    ...over,
  };
}

function resource(over: Partial<CagnotteResource> = {}): CagnotteResource {
  return {
    fromType: "proposition",
    id: "a1",
    name: "Grainothèque",
    resourceTotalAmount: 1000,
    resourceFinancedAmount: 0,
    items: [],
    ...over,
  };
}

const versement = (amount: number, id = "t1") =>
  ({ id, financerName: "Alice", amount, date: 0, paymentStatus: "paid", transactionId: id }) as
    CagnotteFundableItem["allFunding"][number];

describe("resolveCommunDeletionPlan", () => {
  it("sans enveloppe, rien n'est bloqué et rien n'est à supprimer", () => {
    const plan = resolveCommunDeletionPlan(null);
    expect(plan).toEqual({
      projectId: null,
      actionIds: [],
      paymentCount: 0,
      paymentAmount: 0,
      isBlocked: false,
    });
  });

  it("un commun sans versement reste supprimable", () => {
    const plan = resolveCommunDeletionPlan(resource({ items: [item()] }));
    expect(plan.isBlocked).toBe(false);
    expect(plan.paymentCount).toBe(0);
  });

  it("un seul versement suffit à bloquer, et le montant est rapporté", () => {
    const plan = resolveCommunDeletionPlan(
      resource({ items: [item({ allFunding: [versement(4400)] })] })
    );
    expect(plan.isBlocked).toBe(true);
    expect(plan.paymentCount).toBe(1);
    expect(plan.paymentAmount).toBe(4400);
  });

  /**
   * LE CAS PIÈGE. `resourceFinancedAmount` ne somme que les paliers OUVERTS : un
   * commun dont tous les paliers sont clôturés — donc financés PUIS terminés —
   * affiche 0 € et redeviendrait supprimable si on se fiait à lui.
   */
  it("un palier CLÔTURÉ et financé bloque quand même la suppression", () => {
    const plan = resolveCommunDeletionPlan(
      resource({
        // Ce que le reste de l'app calculerait : 0, puisque le palier est clos.
        resourceFinancedAmount: 0,
        items: [item({ status: "close", allFunding: [versement(8400)] })],
      })
    );
    expect(plan.isBlocked).toBe(true);
    expect(plan.paymentAmount).toBe(8400);
  });

  /**
   * `allFunding` est aussi le chemin de REPLI, reconstruit depuis les financeurs
   * bruts quand l'item n'est pas enrichi — le cas courant d'un AAC. Se fier à
   * `funding` seul laisserait passer ces versements-là.
   */
  it("compte les versements du chemin de repli, que `funding` ne porte pas", () => {
    const plan = resolveCommunDeletionPlan(
      resource({ items: [item({ funding: [], allFunding: [versement(500)] })] })
    );
    expect(plan.isBlocked).toBe(true);
    expect(plan.paymentCount).toBe(1);
  });

  it("additionne les versements de tous les paliers", () => {
    const plan = resolveCommunDeletionPlan(
      resource({
        items: [
          item({ itemId: "i1", allFunding: [versement(100, "t1"), versement(200, "t2")] }),
          item({ itemId: "i2", allFunding: [versement(300, "t3")] }),
        ],
      })
    );
    expect(plan.paymentCount).toBe(3);
    expect(plan.paymentAmount).toBe(600);
  });

  it("un montant illisible ne fausse pas le total ni ne masque le blocage", () => {
    const plan = resolveCommunDeletionPlan(
      resource({
        items: [
          item({
            allFunding: [
              { ...versement(0, "t1"), amount: Number.NaN },
              versement(50, "t2"),
            ] as CagnotteFundableItem["allFunding"],
          }),
        ],
      })
    );
    expect(plan.paymentCount).toBe(2);
    expect(plan.paymentAmount).toBe(50);
    expect(plan.isBlocked).toBe(true);
  });

  it("collecte le projet et ses actions, sans doublon", () => {
    const action = (id: string) => ({
      id,
      name: id,
      credits: 0,
      status: "todo" as const,
      tags: [],
      contributors: [],
    });
    const plan = resolveCommunDeletionPlan(
      resource({
        projectId: "proj-1",
        items: [
          item({ itemId: "i1", actions: [action("act-1"), action("act-2")] }),
          // Même action rattachée à deux paliers : la supprimer deux fois
          // échouerait en 404 sur la seconde.
          item({ itemId: "i2", actions: [action("act-2"), action("act-3")] }),
        ],
      })
    );
    expect(plan.projectId).toBe("proj-1");
    expect(plan.actionIds).toEqual(["act-1", "act-2", "act-3"]);
  });

  it("un projet absent ou vide ne devient pas une chaîne à supprimer", () => {
    expect(resolveCommunDeletionPlan(resource({ projectId: "" })).projectId).toBeNull();
    expect(resolveCommunDeletionPlan(resource({ projectId: undefined })).projectId).toBeNull();
  });

  it("résiste à une enveloppe aux tableaux manquants", () => {
    const bancal = { fromType: "proposition", id: "a1", name: "x" } as unknown as CagnotteResource;
    expect(() => resolveCommunDeletionPlan(bancal)).not.toThrow();
    expect(resolveCommunDeletionPlan(bancal).isBlocked).toBe(false);
  });
});
