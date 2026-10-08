/** Messages d'erreur Stripe du formulaire de carte. */

/**
 * Liste des codes d'erreur Stripe que l'on traduit (sinon → `default`).
 * Les messages traduits sont dans `i18n/{fr,en}.json` sous
 * `StripePaymentForm.stripeErrors.*`.
 */
const KNOWN_STRIPE_ERROR_CODES = new Set([
  "card_declined",
  "expired_card",
  "incorrect_cvc",
  "processing_error",
  "rate_limit",
  "authentication_error",
  "invalid_expiry_month",
  "invalid_expiry_year",
  "invalid_number",
]);

/**
 * Retourne la **clé i18n** à traduire pour un code d'erreur Stripe donné.
 * Le call-site doit faire `t(getStripeErrorMessageKey(code))`.
 */
export const getStripeErrorMessageKey = (errorCode: string): string => {
  const key = KNOWN_STRIPE_ERROR_CODES.has(errorCode) ? errorCode : "default";
  return `StripePaymentForm.stripeErrors.${key}`;
};
