/** Lignes de commande de la cagnotte : cible d'une contribution, règlement des promesses, au centime. */
import type { DepenseFunding, Pledge } from "../types";
import { roundToCents } from "./format";

/**
 * Cible de la dépense côté serveur : `milestoneId` (clé résolue par le serveur), sinon `depenseKey`,
 * sinon la position, exacte seulement si `depense` est un vrai tableau (cf. `utils/depenseKey.ts`).
 */
export function cibleDepense(funding: DepenseFunding): { milestoneId?: string; depenseKey?: string } {
  if (funding.milestoneId) return { milestoneId: funding.milestoneId };
  if (funding.depenseKey !== undefined && funding.depenseKey !== "") {
    return { depenseKey: funding.depenseKey };
  }
  return { depenseKey: String(funding.depenseIndex) };
}

/** Montant versé pour régler une promesse : son solde au centime, pas le montant engagé. */
export function montantARegler(pledge: Pledge): number {
  return roundToCents(pledge.remainingAmount ?? pledge.fundingAmount);
}

/** Promesses qu'un règlement peut journaliser : rattachées à une ressource, avec un solde positif. */
export function promessesReglables(pledges: Pledge[]): Array<Pledge & { resourceId: string }> {
  return pledges.filter(
    (pledge): pledge is Pledge & { resourceId: string } =>
      typeof pledge.resourceId !== "undefined" && montantARegler(pledge) > 0,
  );
}

/** Total à régler : somme des soldes des promesses réglables, au centime. */
export function totalARegler(pledges: Pledge[]): number {
  return roundToCents(promessesReglables(pledges).reduce((sum, pledge) => sum + montantARegler(pledge), 0));
}

/** Ligne de commande réglant le solde d'une promesse, ciblée par `finkey` (sinon par `finIndex`). */
export function ligneReglement(pledge: Pledge & { resourceId: string }) {
  return {
    answerId: pledge.resourceId,
    depenseKey: pledge.depenseKey ?? String(pledge.depenseIndex),
    financerId: pledge.financerId,
    finkey: pledge.finkey,
    finIndex: pledge.finkey ? undefined : pledge.fundingIndex,
    amount: montantARegler(pledge),
  };
}
