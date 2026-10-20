/**
 * L'état de paiement d'une ligne `depense.financer[i]` — la seule lecture autorisée du bloc
 * `payment`, que le serveur tient seul (`Aap::recomputeFinancerPayment`).
 *
 * Trois formes coexistent en base, toutes gérées ici (cf. doc/34 §2) :
 *  1. canonique — `payment: { logs, paidAmount, pendingAmount, status }` ;
 *  2. engagement neuf — `payment: { logs: [] }` sans agrégats : `paidAmount` y vaut
 *     `undefined`, pas 0 ;
 *  3. legacy — pas de `payment`. Aucune migration prévue : ce repli est permanent.
 *
 * Montants via `toNumber` et non `toSafeInt`, qui tronquerait les centimes.
 */
import { asRecord, toArrayOrValues, toNumber, toString } from "./dataTransform";

/**
 * Statut d'une ligne dans le vocabulaire du SERVEUR. `payed` (sic) est la valeur qu'écrit
 * `Aap.php` : ne pas la « corriger » en `paid`, réservé à l'affichage.
 */
export type FinancerPaymentStatus = "unpaid" | "partial" | "payed";

/** Un versement journalisé dans `financer.payment.logs[]`. */
export interface FinancerPaymentLog {
  invoiceId: string;
  financerId: string;
  financerName: string;
  finkey: string;
  amount: number;
  /** `manual` | `stripe` | `helloasso` — la façon dont l'argent est arrivé. */
  type: string;
  /** `pending` tant que le porteur n'a pas confirmé la réception des fonds. */
  confirmation: "pending" | "validated";
  paidBy: string;
  validatedBy?: string;
}

export interface FinancerPaymentState {
  /** Montant engagé par la ligne — la promesse, versée ou non. */
  engagedAmount: number;
  /** Encaissé **et validé** par le porteur : le seul montant réellement acquis. */
  paidAmount: number;
  /** Versé mais pas encore confirmé par le porteur. */
  pendingAmount: number;
  /** Engagé sans versement journalisé : la part encore à verser. */
  pledgedAmount: number;
  status: FinancerPaymentStatus;
  /** `true` quand la ligne n'a pas de bloc `payment` — état déduit de `fundingType`. */
  isLegacy: boolean;
}

/** Ce que le helper lit d'une ligne — volontairement plus étroit qu'un `Financer` complet. */
export interface FinancerPaymentInput {
  amount?: unknown;
  payment?: unknown;
  /** LEGACY, lecture seule : `"prepaid"` marquait « payé » avant le bloc `payment`. */
  fundingType?: unknown;
}

/**
 * `payment` n'est exploitable que si c'est un objet NON-tableau : PHP sérialise une map vide
 * en `[]`, qu'`asRecord` accepterait, et la suite lirait `.logs` sur un tableau.
 */
function readPaymentBlock(payment: unknown): Record<string, unknown> | null {
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) return null;
  return payment as Record<string, unknown>;
}

/**
 * Les logs priment sur les agrégats, qui en sont dérivés et peuvent manquer (forme 2).
 * `null` = pas de logs du tout, donc repli sur les agrégats ; une liste vide, elle, est une
 * information (aucun versement → 0/0).
 */
function sumLogs(logs: unknown): { paid: number; pending: number } | null {
  if (logs === undefined || logs === null) return null;
  return toArrayOrValues<unknown>(logs).map(asRecord).reduce<{ paid: number; pending: number }>(
    (acc, log) => {
      const amount = toNumber(log.amount);
      if (toString(log.confirmation) === "validated") acc.paid += amount;
      else acc.pending += amount;
      return acc;
    },
    { paid: 0, pending: 0 },
  );
}

/** Même règle que `Aap::recomputeFinancerPayment` — seuls les versements validés comptent. */
function deriveStatus(paidAmount: number, engagedAmount: number): FinancerPaymentStatus {
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount >= engagedAmount) return "payed";
  return "partial";
}

/** L'état de paiement d'une ligne : promesse de 1000 dont 500 validés → `paidAmount` 500. */
export function readFinancerPaymentState(fund: FinancerPaymentInput | null | undefined): FinancerPaymentState {
  const line = asRecord(fund);
  const engagedAmount = toNumber(line.amount);
  const payment = readPaymentBlock(line.payment);

  // ── Repli legacy : aucune donnée de paiement, l'état se déduit de `fundingType`.
  if (!payment) {
    const isPrepaid = toString(line.fundingType) === "prepaid";
    return {
      engagedAmount,
      paidAmount: isPrepaid ? engagedAmount : 0,
      pendingAmount: 0,
      pledgedAmount: isPrepaid ? 0 : engagedAmount,
      status: isPrepaid ? "payed" : "unpaid",
      isLegacy: true,
    };
  }

  const fromLogs = sumLogs(payment.logs);
  const paidAmount = fromLogs ? fromLogs.paid : toNumber(payment.paidAmount);
  const pendingAmount = fromLogs ? fromLogs.pending : toNumber(payment.pendingAmount);

  return {
    engagedAmount,
    paidAmount,
    pendingAmount,
    // Jamais négatif : un versement supérieur à l'engagement ne doit pas produire
    // une part promise négative qui viendrait défalquer les totaux d'un palier.
    pledgedAmount: Math.max(engagedAmount - paidAmount - pendingAmount, 0),
    status: deriveStatus(paidAmount, engagedAmount),
    isLegacy: false,
  };
}

/** Raccourci de lecture : la ligne est-elle intégralement acquise ? */
export function isFinancerPaid(fund: FinancerPaymentInput | null | undefined): boolean {
  return readFinancerPaymentState(fund).status === "payed";
}

/** Part non acquise d'une ligne : promesse restante et versements en attente de validation. */
export function unpaidAmountOf(fund: FinancerPaymentInput | null | undefined): number {
  const { pledgedAmount, pendingAmount } = readFinancerPaymentState(fund);
  return pledgedAmount + pendingAmount;
}

/** Reste à verser sur une ligne : la promesse restante (un versement en attente de validation est déjà fait). */
export function dueAmountOf(fund: FinancerPaymentInput | null | undefined): number {
  return readFinancerPaymentState(fund).pledgedAmount;
}

/**
 * Traduit le statut serveur vers le vocabulaire d'affichage du module
 * (`FundingPaymentStatus`). Le seul endroit où `payed` devient `paid`.
 */
export function toDisplayPaymentStatus(status: FinancerPaymentStatus): "paid" | "partial" | "pending" {
  if (status === "payed") return "paid";
  if (status === "partial") return "partial";
  return "pending";
}

/** Les logs de versement d'une ligne, normalisés — tableau vide si la ligne n'en porte pas. */
export function readFinancerPaymentLogs(fund: FinancerPaymentInput | null | undefined): FinancerPaymentLog[] {
  const payment = readPaymentBlock(asRecord(fund).payment);
  if (!payment) return [];
  return toArrayOrValues<unknown>(payment.logs).map(asRecord).map((log) => ({
    invoiceId: toString(log.invoiceId),
    financerId: toString(log.financerId),
    financerName: toString(log.financerName),
    finkey: toString(log.finkey),
    amount: toNumber(log.amount),
    type: toString(log.type) || "manual",
    confirmation: toString(log.confirmation) === "validated" ? "validated" : "pending",
    paidBy: toString(log.paidBy),
    validatedBy: toString(log.validatedBy) || undefined,
  }));
}
