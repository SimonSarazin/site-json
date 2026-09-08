/**
 * Totaux de financement d'une ressource cagnotte (projet ou proposition),
 * sommés sur les **mêmes** items — total financé, cible et reste à financer.
 *
 * Pourquoi une fonction dédiée : `CagnotteResource.resourceFinancedAmount` est un
 * agrégat externe dont le périmètre n'est pas celui de `items[]` :
 *  - côté projet, `cagnotteTotalAmount` n'additionne que les milestones du projet,
 *    alors que `items[]` contient aussi les dépenses orphelines (dépense sans
 *    milestone rattaché) ;
 *  - côté proposition, `totalFinancement` est calculé par le backend, dépenses
 *    closes comprises.
 * Lire le total depuis cet agrégat et la cible depuis `items[].price` mélange deux
 * périmètres : le « reste à financer » (donc le plafond de contribution de la modale)
 * en est faussé, et diverge du plafond que `PaymentConfigPage` recalcule sur les
 * items (`maxAllocatable`). Ici, total et cible viennent des mêmes items ouverts ;
 * les agrégats de la ressource ne servent de repli que si elle n'a AUCUN item.
 *
 * Les montants passent par `toSafeInt` : même typés `number`, ils arrivent parfois
 * du backend en string (`"1 500,00"`) ou en bool/null.
 */

import { toSafeInt } from "@/modules/cagnotte/utils/dataTransform";
import type { CagnotteFundableItem, CagnotteResource } from "@/modules/cagnotte/types";

export type FundingTotalsItem = Pick<CagnotteFundableItem, "price" | "currentFunding" | "status">;

export type FundingTotalsFallback = Partial<
  Pick<CagnotteResource, "resourceTotalAmount" | "resourceFinancedAmount">
>;

export interface ResourceFundingTotals {
  /** Montant déjà financé (en euros, entier). */
  totalAmount: number;
  /** Cible à atteindre (en euros, entier). */
  targetAmount: number;
  /** `max(targetAmount - totalAmount, 0)` — plafond de contribution. */
  remainingAmount: number;
}

/** Un item est finançable tant qu'il n'est pas clos (statut absent ⇒ ouvert). */
export function isOpenFundableItem(item: Pick<CagnotteFundableItem, "status"> | null | undefined): boolean {
  return (item?.status || "open") !== "close";
}

/**
 * @param items     Items de la ressource (milestones ou dépenses) ; les items clos sont
 *                  ignorés. Peut contenir les items ouverts seulement ou tous les items.
 * @param fallback  Agrégats de la ressource, lus **uniquement** si `items` est vide.
 */
export function computeResourceFundingTotals(
  items: ReadonlyArray<FundingTotalsItem | null | undefined> | null | undefined,
  fallback?: FundingTotalsFallback | null,
): ResourceFundingTotals {
  const allItems = items ?? [];

  let totalAmount: number;
  let targetAmount: number;

  if (allItems.length > 0) {
    const openItems = allItems.filter(
      (item): item is FundingTotalsItem => !!item && isOpenFundableItem(item),
    );
    totalAmount = openItems.reduce((sum, item) => sum + toSafeInt(item.currentFunding), 0);
    targetAmount = openItems.reduce((sum, item) => sum + toSafeInt(item.price), 0);
  } else {
    totalAmount = toSafeInt(fallback?.resourceFinancedAmount);
    targetAmount = toSafeInt(fallback?.resourceTotalAmount);
  }

  return {
    totalAmount,
    targetAmount,
    remainingAmount: Math.max(targetAmount - totalAmount, 0),
  };
}
