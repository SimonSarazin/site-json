import type { FundingPaymentMethods } from "@/modules/cagnotte/types";

export type PaymentChoice = "stripe" | "helloasso" | "pledge";

/**
 * Moyens proposés au contributeur : ceux que l'entité a configurés (`getEnvelopeData`), plus
 * la promesse quand le type de cagnotte l'autorise. Stripe exige en plus une clé publique.
 * Le paiement en ligne exige un backend qui facture et enregistre lui-même (`serverSettlement`).
 */
export function availablePaymentChoices(
  paymentMethods: FundingPaymentMethods | null | undefined,
  options: { stripePublicKey?: string; allowPledge?: boolean },
): PaymentChoice[] {
  const choices: PaymentChoice[] = [];
  const online = paymentMethods?.serverSettlement === true;
  if (online && paymentMethods?.stripe === true && options.stripePublicKey) choices.push("stripe");
  if (online && paymentMethods?.helloasso === true) choices.push("helloasso");
  if (options.allowPledge) choices.push("pledge");
  return choices;
}
