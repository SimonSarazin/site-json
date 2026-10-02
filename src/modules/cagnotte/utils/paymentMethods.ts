import type { FundingPaymentMethods } from "@/modules/cagnotte/types";

export type PaymentChoice = "stripe" | "helloasso" | "pledge";

/**
 * Moyens proposés au contributeur : ceux que l'entité a configurés (`getEnvelopeData`), plus
 * la promesse quand le type de cagnotte l'autorise. Stripe exige en plus une clé publique.
 */
export function availablePaymentChoices(
  paymentMethods: FundingPaymentMethods | null | undefined,
  options: { stripePublicKey?: string; allowPledge?: boolean },
): PaymentChoice[] {
  const choices: PaymentChoice[] = [];
  if (paymentMethods?.stripe === true && options.stripePublicKey) choices.push("stripe");
  if (paymentMethods?.helloasso === true) choices.push("helloasso");
  if (options.allowPledge) choices.push("pledge");
  return choices;
}
