/** Factures de la cagnotte listées par `cagnotteBills` pour l'onglet « Paiements » de « Mes promesses ». */
import { asRecord, toArrayOrValues, toNumber, toString, type UnknownRecord } from "@/modules/cagnotte/utils/dataTransform";

export type CagnotteBillFilter = "attention" | "all";

/** `all` : toutes les factures de la cagnotte (admin de l'entité) ; `mine` : celles de l'utilisateur. */
export type CagnotteBillScope = "all" | "mine";

export interface CagnotteBill {
  id: string;
  /** Création, en secondes depuis l'epoch. */
  created: number;
  provider: string;
  amount: number;
  /** Statut serveur : `pending`, `settling`, `settled`, `failed`, `expired`. */
  status: string;
  error: string | null;
  attempts: number;
  /** Référence chez le prestataire, posée dès que le paiement est vérifié. */
  reference: string | null;
  payer: { id: string; name: string };
  lines: Array<{ kind: string; answerId: string; amount: number; done: boolean }>;
}

/** Factures et portée de la réponse de `cagnotteBills` : entrée sans id écartée, `scope` absent lu `all`. */
export function readCagnotteBills(response: UnknownRecord): { bills: CagnotteBill[]; scope: CagnotteBillScope } {
  const bills = toArrayOrValues<unknown>(response.bills)
    .map(asRecord)
    .filter((bill) => toString(bill.id) !== "")
    .map((bill) => {
      const payer = asRecord(bill.payer);
      return {
        id: toString(bill.id),
        created: toNumber(bill.created),
        provider: toString(bill.provider),
        amount: toNumber(bill.amount),
        status: toString(bill.status),
        error: toString(bill.error) || null,
        attempts: toNumber(bill.attempts),
        reference: toString(bill.reference) || null,
        payer: { id: toString(payer.id), name: toString(payer.name) },
        lines: toArrayOrValues<unknown>(bill.lines).map(asRecord).map((line) => ({
          kind: toString(line.kind),
          answerId: toString(line.answerId),
          amount: toNumber(line.amount),
          done: line.done === true,
        })),
      };
    });
  return { bills, scope: response.scope === "mine" ? "mine" : "all" };
}

/** Paiement vu chez le prestataire dont l'enregistrement n'a pas abouti : « Réessayer » peut le faire aboutir. */
export function isBillToReconcile(bill: CagnotteBill): boolean {
  return bill.status === "failed" || bill.status === "settling" || (bill.status === "pending" && bill.reference !== null);
}

/** Clé i18n du statut affiché (`PaymentsPanel.status.*`). */
export function billStatusKey(bill: CagnotteBill): string {
  if (bill.status === "failed" || (bill.status === "pending" && bill.reference !== null)) return "unrecorded";
  if (["settled", "settling", "pending", "expired"].includes(bill.status)) return bill.status;
  return "unknown";
}
