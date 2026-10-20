import { describe, expect, it } from "vitest";
import {
  isFinancerPaid,
  readFinancerPaymentLogs,
  readFinancerPaymentState,
  toDisplayPaymentStatus,
  unpaidAmountOf,
  dueAmountOf,
} from "./financerPayment";

/** Un log validé, forme canonique de `Aap::payFinancerEngagement`. */
const validatedLog = (amount: number) => ({
  invoiceId: "FIN-20260805071934-629cd",
  financerId: "629cd652d5c2d64843354542",
  financerName: "RADAMANIRINA Sitraka Philippe",
  finkey: "a-w171hEa1bvz9",
  amount,
  type: "manual",
  confirmation: "validated",
  paidBy: "629cd652d5c2d64843354542",
  validatedBy: "629cd652d5c2d64843354542",
});

const pendingLog = (amount: number, type = "manual") => ({
  invoiceId: "FIN-20260805071935-629cd",
  financerId: "629cd652d5c2d64843354542",
  financerName: "RADAMANIRINA Sitraka Philippe",
  finkey: "a-w171hEa1bvz9",
  amount,
  type,
  confirmation: "pending",
  paidBy: "629cd652d5c2d64843354542",
});

describe("readFinancerPaymentState — format canonique", () => {
  it("lit un versement partiel validé", () => {
    // L'exemple de référence : 500 validés sur un engagement de 1000.
    const state = readFinancerPaymentState({
      amount: 1000,
      payment: { logs: [validatedLog(500)], paidAmount: 500, pendingAmount: 0, status: "partial" },
    });

    expect(state).toMatchObject({
      engagedAmount: 1000,
      paidAmount: 500,
      pendingAmount: 0,
      pledgedAmount: 500,
      status: "partial",
      isLegacy: false,
    });
  });

  it("marque `payed` quand le versement validé couvre l'engagement", () => {
    const state = readFinancerPaymentState({
      amount: 1000,
      payment: { logs: [validatedLog(1000)] },
    });

    expect(state.status).toBe("payed");
    expect(state.pledgedAmount).toBe(0);
  });

  it("ne compte PAS un versement non validé comme payé", () => {
    // Le cœur de la règle serveur : seuls les logs `validated` alimentent paidAmount.
    const state = readFinancerPaymentState({
      amount: 1000,
      payment: { logs: [pendingLog(500)] },
    });

    expect(state).toMatchObject({ paidAmount: 0, pendingAmount: 500, status: "unpaid" });
  });

  it("additionne plusieurs logs et sépare validés et en attente", () => {
    const state = readFinancerPaymentState({
      amount: 1000,
      payment: { logs: [validatedLog(300), validatedLog(200), pendingLog(400)] },
    });

    expect(state).toMatchObject({
      paidAmount: 500,
      pendingAmount: 400,
      pledgedAmount: 100,
      status: "partial",
    });
  });

  it("préfère les logs aux agrégats quand les deux divergent", () => {
    // Les agrégats peuvent être périmés ; les logs sont la source de vérité,
    // exactement comme `recomputeFinancerPayment` les dérive.
    const state = readFinancerPaymentState({
      amount: 1000,
      payment: { logs: [validatedLog(500)], paidAmount: 0, pendingAmount: 0, status: "unpaid" },
    });

    expect(state.paidAmount).toBe(500);
    expect(state.status).toBe("partial");
  });

  it("retombe sur les agrégats quand les logs sont absents", () => {
    const state = readFinancerPaymentState({
      amount: 1000,
      payment: { paidAmount: 750, pendingAmount: 250, status: "partial" },
    });

    expect(state).toMatchObject({ paidAmount: 750, pendingAmount: 250, pledgedAmount: 0 });
  });

  it("lit des logs sérialisés en objet keyé", () => {
    // Même forme Mongo que `depense.financer`. Sans ce support, les montants
    // seraient silencieusement ignorés au profit d'agrégats parfois absents.
    const state = readFinancerPaymentState({
      amount: 1000,
      payment: { logs: { "0": validatedLog(400), "1": pendingLog(100) } },
    });

    expect(state).toMatchObject({ paidAmount: 400, pendingAmount: 100, status: "partial" });
  });

  it("distingue « aucun log » de « liste de logs vide »", () => {
    // Liste vide : l'information est fiable (aucun versement), on ignore les agrégats.
    const listeVide = readFinancerPaymentState({
      amount: 1000,
      payment: { logs: [], paidAmount: 999, pendingAmount: 0 },
    });
    expect(listeVide.paidAmount).toBe(0);

    // Champ absent : rien à déduire, on lit les agrégats.
    const sansLogs = readFinancerPaymentState({
      amount: 1000,
      payment: { paidAmount: 999, pendingAmount: 0 },
    });
    expect(sansLogs.paidAmount).toBe(999);
  });

  it("ne rend jamais une part promise négative", () => {
    const state = readFinancerPaymentState({
      amount: 100,
      payment: { logs: [validatedLog(250)] },
    });

    expect(state.pledgedAmount).toBe(0);
    expect(state.status).toBe("payed");
  });
});

describe("readFinancerPaymentState — engagement neuf", () => {
  it("traite `payment: { logs: [] }` comme un engagement sans versement", () => {
    // `addFinancerEngagement` pose ce bloc AVANT que recompute n'ait tourné :
    // paidAmount/pendingAmount/status n'existent pas encore.
    const state = readFinancerPaymentState({ amount: 1000, payment: { logs: [] } });

    expect(state).toMatchObject({
      paidAmount: 0,
      pendingAmount: 0,
      pledgedAmount: 1000,
      status: "unpaid",
      isLegacy: false,
    });
  });

  it("survit à un `payment` sérialisé en tableau vide", () => {
    // PHP rend les maps vides en `[]` : un accès naïf à `payment.status` planterait
    // ou renverrait undefined. On bascule sur le repli legacy plutôt que de casser.
    expect(() => readFinancerPaymentState({ amount: 500, payment: [] })).not.toThrow();
    expect(readFinancerPaymentState({ amount: 500, payment: [] })).toMatchObject({
      pledgedAmount: 500,
      status: "unpaid",
      isLegacy: true,
    });
  });
});

describe("readFinancerPaymentState — repli legacy", () => {
  it("compte une ligne `prepaid` comme intégralement payée", () => {
    const state = readFinancerPaymentState({ amount: 500, fundingType: "prepaid" });

    expect(state).toMatchObject({
      paidAmount: 500,
      pledgedAmount: 0,
      status: "payed",
      isLegacy: true,
    });
  });

  it("compte une ligne sans `fundingType` comme une promesse", () => {
    const state = readFinancerPaymentState({ amount: 500 });

    expect(state).toMatchObject({ paidAmount: 0, pledgedAmount: 500, status: "unpaid", isLegacy: true });
  });

  it("préserve les centimes plutôt que de tronquer", () => {
    // `toSafeInt` ferait 500 ; les montants d'argent passent par `toNumber`.
    expect(readFinancerPaymentState({ amount: 500.5 }).pledgedAmount).toBe(500.5);
  });

  it("coerce un montant arrivé en chaîne", () => {
    expect(readFinancerPaymentState({ amount: "250" }).pledgedAmount).toBe(250);
  });

  it("ne casse ni sur null ni sur undefined", () => {
    expect(readFinancerPaymentState(null)).toMatchObject({ engagedAmount: 0, status: "unpaid" });
    expect(readFinancerPaymentState(undefined).pledgedAmount).toBe(0);
  });
});

describe("unpaidAmountOf", () => {
  it("additionne la part promise et les versements en attente de validation", () => {
    // Un versement non validé reste dû du point de vue du financeur.
    const fund = { amount: 1000, payment: { logs: [validatedLog(200), pendingLog(300)] } };

    expect(unpaidAmountOf(fund)).toBe(800);
  });

  it("rend 0 sur une ligne intégralement validée", () => {
    expect(unpaidAmountOf({ amount: 1000, payment: { logs: [validatedLog(1000)] } })).toBe(0);
  });

  it("rend le montant entier d'une promesse legacy", () => {
    expect(unpaidAmountOf({ amount: 400 })).toBe(400);
  });
});

describe("isFinancerPaid", () => {
  it("distingue payé, partiel et promis", () => {
    expect(isFinancerPaid({ amount: 100, payment: { logs: [validatedLog(100)] } })).toBe(true);
    expect(isFinancerPaid({ amount: 100, payment: { logs: [validatedLog(50)] } })).toBe(false);
    expect(isFinancerPaid({ amount: 100, fundingType: "prepaid" })).toBe(true);
    expect(isFinancerPaid({ amount: 100 })).toBe(false);
  });
});

describe("toDisplayPaymentStatus", () => {
  it("traduit le vocabulaire serveur vers celui de l'affichage", () => {
    expect(toDisplayPaymentStatus("payed")).toBe("paid");
    expect(toDisplayPaymentStatus("partial")).toBe("partial");
    expect(toDisplayPaymentStatus("unpaid")).toBe("pending");
  });
});

describe("readFinancerPaymentLogs", () => {
  it("normalise les logs d'une ligne canonique", () => {
    const logs = readFinancerPaymentLogs({
      amount: 1000,
      payment: { logs: [validatedLog(500), pendingLog(200, "stripe")] },
    });

    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      invoiceId: "FIN-20260805071934-629cd",
      amount: 500,
      confirmation: "validated",
      validatedBy: "629cd652d5c2d64843354542",
    });
    expect(logs[1]).toMatchObject({ type: "stripe", confirmation: "pending", validatedBy: undefined });
  });

  it("rend un tableau vide pour une ligne legacy ou sans logs", () => {
    expect(readFinancerPaymentLogs({ amount: 100, fundingType: "prepaid" })).toEqual([]);
    expect(readFinancerPaymentLogs({ amount: 100, payment: { logs: [] } })).toEqual([]);
    expect(readFinancerPaymentLogs(null)).toEqual([]);
  });

  it("accepte des logs sérialisés en objet keyé", () => {
    // Même forme Mongo que `depense.financer` : `{ "0": {...} }`.
    const logs = readFinancerPaymentLogs({ amount: 100, payment: { logs: { "0": validatedLog(100) } } });

    expect(logs).toHaveLength(1);
    expect(logs[0].amount).toBe(100);
  });

  it("défaut `manual` quand le type de versement manque", () => {
    const logs = readFinancerPaymentLogs({ amount: 100, payment: { logs: [{ amount: 100 }] } });

    expect(logs[0].type).toBe("manual");
    expect(logs[0].confirmation).toBe("pending");
  });
});

describe("dueAmountOf", () => {
  it("ne compte que la promesse restante : un versement en attente de validation est déjà fait", () => {
    const fund = { amount: 1000, payment: { logs: [validatedLog(200), pendingLog(300)] } };

    expect(dueAmountOf(fund)).toBe(500);
  });

  it("rend 0 quand tout est versé, même en attente de validation", () => {
    expect(dueAmountOf({ amount: 1000, payment: { logs: [pendingLog(1000)] } })).toBe(0);
  });

  it("rend le montant entier d'une promesse legacy", () => {
    expect(dueAmountOf({ amount: 400 })).toBe(400);
  });
});
