import { describe, expect, it } from "vitest";
import {
  findPledgeLine,
  hasPaymentInProgress,
  isOwnPledgeLine,
  isRetractablePledgeLine,
  readDepensesInProgress,
  readPledgesInProgress,
  readPledgesLockedForSelection,
  retractErrorKind,
} from "./pledgeRetraction";

/** Promesse simple, telle qu'`Aap::addFinancerEngagement` l'écrit. */
const promesse = (extra: Record<string, unknown> = {}) => ({
  line: "",
  amount: 100,
  id: "u1",
  name: "Alice",
  status: "pending",
  finkey: "a-1",
  payment: { logs: [] },
  ...extra,
});

describe("isRetractablePledgeLine — même règle que `Aap::financerLineDeleteBlock`", () => {
  it("une promesse sans versement se retire", () => {
    expect(isRetractablePledgeLine(promesse())).toBe(true);
    expect(isRetractablePledgeLine(promesse({ payment: undefined, status: undefined }))).toBe(true);
  });

  it("sans finkey ni financeur, pas de retrait : la ligne ne se vise pas", () => {
    expect(isRetractablePledgeLine(promesse({ finkey: "" }))).toBe(false);
    expect(isRetractablePledgeLine(promesse({ id: "" }))).toBe(false);
  });

  it.each([
    ["versement validé", { payment: { logs: [{ amount: 10, confirmation: "validated" }] } }],
    ["versement en attente", { payment: { logs: [{ amount: 10, confirmation: "pending" }] } }],
    ["logs en objet", { payment: { logs: { 0: { amount: 10 } } } }],
    ["agrégat payé", { payment: { logs: [], paidAmount: 5 } }],
    ["agrégat en attente", { payment: { logs: [], pendingAmount: "5" } }],
    ["agrégat illisible", { payment: { logs: [], paidAmount: "5 €" } }],
    ["prepaid legacy", { fundingType: "prepaid", payment: undefined }],
    ["status paid", { status: "paid" }],
    ["status distributed", { status: "distributed" }],
    ["status 0", { status: 0 }],
    ["payment_method", { payment_method: "card" }],
    ["method", { method: "stripe" }],
    ["transactionId", { transactionId: "pi_1" }],
    ["bill", { bill: "none" }],
    ["ref de facture", { ref: "b1:0" }],
    ["cofinancement (original)", { iscofinancementftl: true }],
    ["cofinancement en chaîne", { iscofinancementftl: "false" }],
    ["cofinancement (jumeau)", { tlid: "org1" }],
  ])("refus : %s", (_label, extra) => {
    expect(isRetractablePledgeLine(promesse(extra))).toBe(false);
  });

  it("valeurs vides au sens de PHP : pas de blocage", () => {
    expect(
      isRetractablePledgeLine(
        promesse({ iscofinancementftl: false, tlid: "", bill: "", ref: null, method: "0", payment: { logs: [], paidAmount: 0, pendingAmount: "0" } }),
      ),
    ).toBe(true);
  });
});

describe("isOwnPledgeLine", () => {
  it("soi-même ou une organisation administrée", () => {
    expect(isOwnPledgeLine(promesse(), "u1", [])).toBe(true);
    expect(isOwnPledgeLine(promesse({ id: "org1" }), "u2", ["org1"])).toBe(true);
    expect(isOwnPledgeLine(promesse(), "u2", ["org1"])).toBe(false);
    expect(isOwnPledgeLine(promesse({ id: "" }), "", [])).toBe(false);
  });
});

describe("findPledgeLine — la ligne et la CLÉ de sa dépense", () => {
  it("dépenses en objet à clés creuses : la clé, pas la position", () => {
    const depenses = { 0: { financer: [promesse({ finkey: "a-0" })] }, 3: { financer: [promesse()] } };
    expect(findPledgeLine(depenses, "a-1", "u1")).toMatchObject({ depenseKey: "3", line: { finkey: "a-1" } });
  });

  it("financer en objet", () => {
    const depenses = [{ financer: { 0: promesse({ finkey: "a-0" }), 2: promesse() } }];
    expect(findPledgeLine(depenses, "a-1", "u1")?.depenseKey).toBe("0");
  });

  it("le jumeau de cofinancement partage la finkey : départagé par le financeur", () => {
    const depenses = [{ financer: [promesse({ finkey: "a-7", id: "u1" }), promesse({ finkey: "a-7", id: "org1", tlid: "u1" })] }];
    expect(findPledgeLine(depenses, "a-7", "org1")?.line.id).toBe("org1");
  });

  it("absente, ambiguë ou sans cible : null", () => {
    const depenses = [{ financer: [promesse()] }, { financer: [promesse()] }];
    expect(findPledgeLine(depenses, "a-1", "u1")).toBeNull();
    expect(findPledgeLine(depenses, "a-9", "u1")).toBeNull();
    expect(findPledgeLine(depenses, "", "u1")).toBeNull();
    expect(findPledgeLine(undefined, "a-1", "u1")).toBeNull();
  });
});

describe("readPledgesInProgress — `paymentsInProgress` de l'enveloppe ou de la relecture", () => {
  const enveloppe = {
    paymentsInProgress: {
      ans1: {
        pledges: [
          { finkey: "a-autre", kind: "hold", mine: false, until: 1 },
          { finkey: "a-moi", kind: "hold", mine: true, until: 1 },
          { finkey: "a-facture", kind: "bill", mine: true, until: 1 },
        ],
        depenses: [],
      },
    },
  };

  it("toute réservation et toute facture ouverte : en cours, celles de l'utilisateur comprises", () => {
    const enCours = readPledgesInProgress(enveloppe);
    expect(enCours("ans1", "a-autre")).toBe(true);
    expect(enCours("ans1", "a-facture")).toBe(true);
    expect(enCours("ans1", "a-moi")).toBe(true);
    expect(enCours("ans1", "a-libre")).toBe(false);
    expect(enCours("ans2", "a-autre")).toBe(false);
    expect(enCours("ans1", "")).toBe(false);
  });

  it("pour la liste de « Mes promesses », la réservation de cet onglet n'en est pas une : c'est sa sélection", () => {
    const verrouillee = readPledgesLockedForSelection(enveloppe);
    expect(verrouillee("ans1", "a-moi")).toBe(false);
    expect(verrouillee("ans1", "a-autre")).toBe(true);
    expect(verrouillee("ans1", "a-facture")).toBe(true);
    expect(verrouillee("ans1", "")).toBe(false);
    expect(readPledgesLockedForSelection({ paymentsInProgress: [] })("ans1", "a-moi")).toBe(false);
  });

  it("backend sans l'annonce, ou liste vide sérialisée en tableau : rien en cours", () => {
    expect(readPledgesInProgress({})("ans1", "a-1")).toBe(false);
    expect(readPledgesInProgress({ paymentsInProgress: [] })("ans1", "a-1")).toBe(false);
    expect(readPledgesInProgress(null)("ans1", "a-1")).toBe(false);
  });
});

describe("readDepensesInProgress — contributions en cours", () => {
  const enveloppe = {
    paymentsInProgress: {
      ans1: { pledges: [], depenses: [{ milestoneId: "m1", depenseKey: "0" }, { milestoneId: "", depenseKey: "3" }] },
    },
  };

  it("visée par le jalon quand la contribution en a un, sinon par la clé de la dépense", () => {
    const enCours = readDepensesInProgress(enveloppe);
    expect(enCours("ans1", "m1", "7")).toBe(true);
    expect(enCours("ans1", "m2", "0")).toBe(false);
    expect(enCours("ans1", "", "3")).toBe(true);
    expect(enCours("ans1", "", null)).toBe(false);
    expect(enCours("ans2", "m1", "0")).toBe(false);
  });

  it("backend sans l'annonce : rien en cours", () => {
    expect(readDepensesInProgress({})("ans1", "m1", "0")).toBe(false);
    expect(readDepensesInProgress({ paymentsInProgress: { ans1: { pledges: [] } } })("ans1", "m1", "0")).toBe(false);
  });
});

describe("hasPaymentInProgress — un paiement en cours sur la réponse", () => {
  it("promesse réservée ou facturée, ou contribution, quel qu'en soit l'auteur", () => {
    const promesse = { paymentsInProgress: { ans1: { pledges: [{ finkey: "a-1", kind: "hold", mine: true }], depenses: [] } } };
    const contribution = { paymentsInProgress: { ans1: { pledges: [], depenses: [{ milestoneId: "m1" }] } } };
    expect(hasPaymentInProgress(promesse, "ans1")).toBe(true);
    expect(hasPaymentInProgress(contribution, "ans1")).toBe(true);
    expect(hasPaymentInProgress(contribution, "ans2")).toBe(false);
    expect(hasPaymentInProgress({ paymentsInProgress: { ans1: { pledges: [], depenses: [] } } }, "ans1")).toBe(false);
    expect(hasPaymentInProgress(null, "ans1")).toBe(false);
  });
});

describe("retractErrorKind — statuts posés par le SDK", () => {
  const apiError = (status: number) => Object.assign(new Error("x"), { name: "ApiError", status });

  it("409 argent ou paiement en cours, 404 introuvable, 403 droits, sinon générique", () => {
    expect(retractErrorKind(apiError(409))).toBe("hasPayment");
    expect(retractErrorKind(apiError(404))).toBe("notFound");
    expect(retractErrorKind(apiError(403))).toBe("notAllowed");
    expect(retractErrorKind(apiError(400))).toBe("generic");
  });

  it("session expirée : connexion ; route absente (ApiClientError) : générique", () => {
    expect(retractErrorKind(Object.assign(new Error("x"), { name: "ApiAuthenticationError" }))).toBe("login");
    expect(retractErrorKind(Object.assign(new Error("x"), { name: "ApiClientError", status: 404 }))).toBe("generic");
    expect(retractErrorKind("boom")).toBe("generic");
  });
});
