import { describe, it, expect } from "vitest";
import type { CagnotteFundableItem } from "@/modules/cagnotte/types";
import { buildResourceFromAnswer } from "@/modules/cagnotte/utils/dataTransform";
import { aggregateCofinancers } from "./cofinancers";

type Ligne = Partial<CagnotteFundableItem["allFunding"][number]> & { name?: string; type?: string };

function item(over: Omit<Partial<CagnotteFundableItem>, "allFunding"> & { allFunding?: Ligne[] }): CagnotteFundableItem {
  return {
    fromType: "depense",
    itemId: "0",
    milestoneId: "",
    depenseIndex: 0,
    name: "Palier",
    price: 1000,
    status: "open",
    actions: [],
    funding: [],
    currentFunding: 0,
    unpaidFunding: 0,
    userPledge: 0,
    ...over,
    allFunding: (over.allFunding ?? []) as CagnotteFundableItem["allFunding"],
  };
}

describe("aggregateCofinancers — M16", () => {
  /**
   * Le doublonnage porteur (doc/34 §2) : une 2ᵉ entrée `financer` SÉPARÉE, sans
   * `id`. Avant, la table l'écartait (500 € listés) tandis que la carte la
   * comptait (600 € · 2 cofinanceurs).
   */
  it("une ligne sans `financerId` fait sa propre ligne, agrégée sur son nom", () => {
    const rows = aggregateCofinancers([
      item({
        allFunding: [
          { financerId: "org1", financerName: "CAE Sud", amount: 500 },
          { financerName: "Doublonnage porteur", amount: 100, fundingType: "prepaid" },
        ],
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => [r.financerId, r.name, r.totalAmount])).toEqual([
      ["org1", "CAE Sud", 500],
      [null, "Doublonnage porteur", 100],
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  it("deux lignes du même financeur (par id, ou par nom sans id) se cumulent", () => {
    const rows = aggregateCofinancers([
      item({ allFunding: [{ financerId: "org1", financerName: "CAE Sud", amount: 500 }] }),
      item({
        itemId: "1",
        allFunding: [
          { financerId: "org1", financerName: "CAE Sud", amount: 250 },
          { name: "Anonyme A", amount: 10 },
          { name: "Anonyme A", amount: 5 },
        ],
      }),
    ]);

    expect(rows.map((r) => [r.name, r.totalAmount])).toEqual([
      ["CAE Sud", 750],
      ["Anonyme A", 15],
    ]);
  });

  it("une ligne sans id ni nom n'est pas écartée : elle compte pour une entrée distincte", () => {
    const rows = aggregateCofinancers([
      item({ allFunding: [{ amount: 30 }, { amount: 20 }] }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.financerId === null && r.name === "")).toBe(true);
    expect(rows.map((r) => r.totalAmount)).toEqual([30, 20]);
  });

  it("les paliers clos sont hors périmètre, comme dans les totaux de la carte", () => {
    const rows = aggregateCofinancers([
      item({ status: "close", allFunding: [{ financerId: "u1", financerName: "Clos", amount: 900 }] }),
      item({ itemId: "1", allFunding: [{ financerId: "u2", financerName: "Ouvert", amount: 10 }] }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Ouvert"]);
  });

  it("le repli `name`/`type` des documents anciens est lu", () => {
    const [row] = aggregateCofinancers([
      item({ allFunding: [{ financerId: "o1", name: "Ancien", type: "tl", amount: 1 }] }),
    ]);
    expect(row.name).toBe("Ancien");
    expect(row.type).toBe("tl");
  });

  describe("répartition acquis / encore dû", () => {
    it("scinde une ligne partiellement validée sans changer son total", () => {
      const [row] = aggregateCofinancers([
        item({
          allFunding: [
            {
              financerId: "o1",
              financerName: "CAE Sud",
              amount: 1000,
              payment: { logs: [{ amount: 400, confirmation: "validated" }] },
            } as never,
          ],
        }),
      ]);

      expect(row.totalAmount).toBe(1000);
      expect(row.paidAmount).toBe(400);
      expect(row.pledgedAmount).toBe(600);
    });

    it("cumule la répartition sur plusieurs lignes d'un même cofinanceur", () => {
      const [row] = aggregateCofinancers([
        item({
          allFunding: [
            {
              financerId: "o1",
              financerName: "CAE Sud",
              amount: 500,
              payment: { logs: [{ amount: 500, confirmation: "validated" }] },
            } as never,
            { financerId: "o1", financerName: "CAE Sud", amount: 300 } as never,
          ],
        }),
      ]);

      expect(row.totalAmount).toBe(800);
      expect(row.paidAmount).toBe(500);
      expect(row.pledgedAmount).toBe(300);
    });

    it("classe une ligne legacy selon `fundingType`", () => {
      const rows = aggregateCofinancers([
        item({
          allFunding: [
            { financerId: "o1", financerName: "Payé", amount: 200, fundingType: "prepaid" } as never,
            { financerId: "o2", financerName: "Promis", amount: 300 } as never,
          ],
        }),
      ]);

      expect(rows[0]).toMatchObject({ paidAmount: 200, pledgedAmount: 0 });
      expect(rows[1]).toMatchObject({ paidAmount: 0, pledgedAmount: 300 });
    });

    it("le décompte de cofinanceurs reste inchangé, quel que soit le statut", () => {
      // La règle du module : on compte les cofinanceurs, pas les paiements.
      const rows = aggregateCofinancers([
        item({
          allFunding: [
            { financerId: "o1", financerName: "A", amount: 100 } as never,
            {
              financerId: "o2",
              financerName: "B",
              amount: 100,
              payment: { logs: [{ amount: 100, confirmation: "validated" }] },
            } as never,
          ],
        }),
      ]);

      expect(rows).toHaveLength(2);
    });

    it("lit le versement validé d'une ligne passée par `buildResourceFromAnswer`", () => {
      const resource = buildResourceFromAnswer({
        id: "answer-1",
        answers: {
          aapStep1: {
            depense: [
              {
                poste: "Dev",
                price: 500,
                financer: [
                  { id: "o1", name: "A", amount: 500, payment: { logs: [{ amount: 500, confirmation: "validated" }] } },
                ],
              },
            ],
          },
        },
      })!;

      expect(aggregateCofinancers(resource.items)[0]).toMatchObject({ paidAmount: 500, pledgedAmount: 0 });
    });
  });
});
