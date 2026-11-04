/**
 * Retrait d'une promesse (`depense.financer[i]`) : même règle que `Aap::financerLineDeleteBlock`, jamais plus
 * permissive, et lecture des paiements en cours (`paymentsInProgress`) qui bloquent un retrait.
 */
import { asRecord, toArrayOrValues, toId, toString, type UnknownRecord } from "./coerce";
import { listDepenseKeys } from "./depenseKey";
import { readFinancerPaymentLogs } from "./financerPayment";

/** `empty()` de PHP : `null`, `false`, `0`, `""`, `"0"`, tableau ou objet vide. */
function isPhpEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === 0 || value === "" || value === "0") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/** Un agrégat de paiement non nul, ou illisible : compté comme de l'argent. */
function isNonZeroAmount(value: unknown): boolean {
  return !isPhpEmpty(value) && Number(value) !== 0;
}

/** Statut d'engagement sans paiement : absent, vide ou `pending`. */
function isUnpaidStatus(status: unknown): boolean {
  return status === undefined || status === null || status === false || status === "" || status === "pending";
}

/**
 * La ligne peut-elle être retirée : `finkey` et financeur, aucun argent (versement, marqueur legacy, facture), pas
 * de cofinancement ? Les droits se vérifient à part (`isOwnPledgeLine`, admin du commun).
 */
export function isRetractablePledgeLine(rawLine: unknown): boolean {
  const line = asRecord(rawLine);
  if (toString(line.finkey) === "" || toId(line.id) === "") return false;
  if (readFinancerPaymentLogs(line).length > 0) return false;
  const payment = asRecord(line.payment);
  if (isNonZeroAmount(payment.paidAmount) || isNonZeroAmount(payment.pendingAmount)) return false;
  if (line.fundingType === "prepaid" || !isUnpaidStatus(line.status)) return false;
  const markers = [line.payment_method, line.method, line.transactionId, line.bill, line.ref];
  if (markers.some((marker) => !isPhpEmpty(marker))) return false;
  return isPhpEmpty(line.iscofinancementftl) && isPhpEmpty(line.tlid);
}

/** L'utilisateur agit-il au nom du financeur de la ligne (lui-même ou une organisation qu'il administre) ? */
export function isOwnPledgeLine(rawLine: unknown, userId: string | undefined, adminOrgIds: readonly string[]): boolean {
  const financerId = toId(asRecord(rawLine).id);
  return financerId !== "" && (financerId === userId || adminOrgIds.includes(financerId));
}

export interface PledgeLineMatch {
  /** Clé de la dépense dans le document, pas sa position. */
  depenseKey: string;
  line: UnknownRecord;
}

/**
 * La ligne de cette `finkey` et de ce financeur dans un bloc `depense` brut, avec la clé de sa dépense.
 * `null` si elle est absente ou ambiguë.
 */
export function findPledgeLine(depenses: unknown, finkey: string, financerId: string): PledgeLineMatch | null {
  if (!finkey || !financerId) return null;
  const keys = listDepenseKeys(depenses);
  const matches = toArrayOrValues<unknown>(depenses).flatMap((depense, index) =>
    toArrayOrValues<unknown>(asRecord(depense).financer)
      .map(asRecord)
      .filter((line) => toString(line.finkey) === finkey && toId(line.id) === financerId)
      .map((line) => ({ depenseKey: keys[index], line })),
  );
  return matches.length === 1 ? matches[0] : null;
}

/** Une promesse est-elle en cours de paiement (réservée ou facturée) ? */
export type PaymentInProgressReader = (answerId: string, finkey: string) => boolean;

/** Les entrées `pledges` de cette promesse dans `paymentsInProgress`. */
function pledgeLocks(source: unknown, answerId: string, finkey: string): UnknownRecord[] {
  if (finkey === "") return [];
  const byAnswer = asRecord(asRecord(source).paymentsInProgress);
  return toArrayOrValues<unknown>(asRecord(byAnswer[answerId]).pledges)
    .map(asRecord)
    .filter((entry) => toString(entry.finkey) === finkey);
}

/**
 * Lit `paymentsInProgress` (`{answerId: {pledges: [{finkey, kind: hold|bill, mine, until}]}}`), de l'enveloppe ou de
 * `usePledgesInProgress` : toute réservation et toute facture ouverte comptent, celles de l'utilisateur comprises.
 */
export function readPledgesInProgress(source: unknown): PaymentInProgressReader {
  return (answerId, finkey) => pledgeLocks(source, answerId, finkey).length > 0;
}

/**
 * Pour la liste de « Mes promesses » : comme `readPledgesInProgress`, sauf les réservations de cet onglet (`kind: hold`,
 * `mine`), qui sont sa propre sélection.
 */
export function readPledgesLockedForSelection(source: unknown): PaymentInProgressReader {
  return (answerId, finkey) =>
    pledgeLocks(source, answerId, finkey).some((entry) => !(entry.kind === "hold" && entry.mine === true));
}

/** Une contribution est-elle en cours sur une dépense (visée par son jalon, à défaut par sa clé) ? */
export type DepenseInProgressReader = (answerId: string, milestoneId: string, depenseKey: string | null) => boolean;

/** Lit les dépenses de `paymentsInProgress` (`{answerId: {depenses: [{milestoneId, depenseKey}]}}`). */
export function readDepensesInProgress(source: unknown): DepenseInProgressReader {
  const byAnswer = asRecord(asRecord(source).paymentsInProgress);
  return (answerId, milestoneId, depenseKey) =>
    toArrayOrValues<unknown>(asRecord(byAnswer[answerId]).depenses)
      .map(asRecord)
      .some((target) => {
        const targetMilestone = toString(target.milestoneId);
        return targetMilestone !== ""
          ? targetMilestone === milestoneId
          : depenseKey !== null && toString(target.depenseKey) === depenseKey;
      });
}

/** Un paiement est-il en cours sur une réponse : promesse réservée ou facturée, ou contribution ? */
export function hasPaymentInProgress(source: unknown, answerId: string): boolean {
  const entry = asRecord(asRecord(asRecord(source).paymentsInProgress)[answerId]);
  return toArrayOrValues<unknown>(entry.pledges).length > 0 || toArrayOrValues<unknown>(entry.depenses).length > 0;
}

export type RetractErrorKind = "hasPayment" | "notFound" | "notAllowed" | "login" | "generic";

/** Classe une erreur de `Answer.deleteFinancer` (statuts posés par le SDK sur le message du serveur). */
export function retractErrorKind(error: unknown): RetractErrorKind {
  if (!(error instanceof Error)) return "generic";
  if (error.name === "ApiAuthenticationError") return "login";
  if (error.name !== "ApiError" || !("status" in error)) return "generic";
  if (error.status === 409) return "hasPayment";
  if (error.status === 404) return "notFound";
  if (error.status === 403) return "notAllowed";
  return "generic";
}
