/**
 * Service Stripe pour intégration des paiements
 * Gère les configurations et validations Stripe
 */

import { Stripe, PaymentMethod } from "@stripe/stripe-js";

export interface StripePaymentConfig {
  amount: number;
  projectName: string;
  projectId: string;
  milestoneIds: string[];
  contributorType: "citoyens" | "organizations";
  organizationId?: string;
  email?: string;
}

// Configuration Stripe (Vite frontend)
const STRIPE_CONFIG = {
  // Variables d'environnement Vite attendues
  publicKey:
    String(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "").trim() ||
    String(import.meta.env.VITE_STRIPE_PUBLIC_KEY_TEST || "").trim() ||
    String(import.meta.env.VITE_STRIPE_PUBLIC_KEY_LIVE || "").trim(),
  isDevelopment: import.meta.env.DEV,
};

export const getStripePublicKey = (): string => {
  const key = STRIPE_CONFIG.publicKey;

  if (!key) {
    console.error(
      "[Stripe] Aucune clé publique détectée. Configurez VITE_STRIPE_PUBLIC_KEY dans .env(.local)."
    );
    return "";
  }

  if (!key.startsWith("pk_test_") && !key.startsWith("pk_live_")) {
    console.error(
      "[Stripe] Clé publique invalide: la clé doit commencer par pk_test_ ou pk_live_."
    );
    return "";
  }

  if (STRIPE_CONFIG.isDevelopment && key.startsWith("pk_live_")) {
    console.warn("[Stripe] Clé live utilisée en mode développement.");
  }

  return key;
};

/**
 * Codes d'erreur retournés par validateStripeConfig.
 * Les messages traduits sont dans `i18n/{fr,en}.json` sous
 * `StripePaymentForm.configErrors.*`.
 */
export type StripeConfigErrorCode =
  | "amountInvalid"
  | "amountTooHigh"
  | "projectNameRequired"
  | "projectIdRequired"
  | "milestoneRequired"
  | "contributorTypeRequired";

/**
 * Valide la configuration du paiement Stripe.
 * Retourne des codes d'erreur stables, à traduire côté UI via
 * `t("StripePaymentForm.configErrors." + code)`.
 */
export const validateStripeConfig = (
  config: Partial<StripePaymentConfig>
): { valid: boolean; errors: StripeConfigErrorCode[] } => {
  const errors: StripeConfigErrorCode[] = [];

  if (!config.amount || config.amount <= 0) {
    errors.push("amountInvalid");
  }
  if (config.amount && config.amount > 99999) {
    errors.push("amountTooHigh");
  }
  if (!config.projectName) {
    errors.push("projectNameRequired");
  }
  if (!config.projectId) {
    errors.push("projectIdRequired");
  }
  if (!config.milestoneIds || config.milestoneIds.length === 0) {
    errors.push("milestoneRequired");
  }
  if (!config.contributorType) {
    errors.push("contributorTypeRequired");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Crée les données de paiement finalisées pour Stripe
 */
export const buildStripePaymentData = (
  config: StripePaymentConfig,
  paymentMethod: PaymentMethod,
  transactionId: string
) => ({
  transactionId,
  stripePaymentMethodId: paymentMethod.id,
  stripeCardBrand: paymentMethod.card?.brand || "unknown",
  stripeCardLast4: paymentMethod.card?.last4 || "****",
  method: "stripe" as const,
  amount: config.amount,
  projectName: config.projectName,
  projectId: config.projectId,
  milestones: config.milestoneIds,
  contributorType: config.contributorType,
  organizationId: config.organizationId || null,
  email: config.email || null,
  timestamp: new Date().toISOString(),
  status: "succeeded" as const,
});

/**
 * Formatte un montant pour affichage Stripe
 */
export const formatStripeAmount = (amountInEuros: number): number => {
  // Stripe utilise les centimes pour EUR
  return Math.round(amountInEuros * 100);
};

/**
 * Crée un client intent pour le paiement Stripe
 * (si utilisation de Payment Intent au lieu de PaymentMethod)
 */
/**
 * @deprecated Placeholder non utilisé — la création du PaymentIntent
 * se fait côté serveur. Throw avec des codes d'erreur stables
 * (`stripeNotInitialized`, `amountMustBePositive`) à traduire côté UI.
 */
export const prepareStripePaymentIntent = async (
  stripe: Stripe | null,
  amount: number
) => {
  if (!stripe) {
    throw new Error("stripeNotInitialized");
  }

  if (amount <= 0) {
    throw new Error("amountMustBePositive");
  }

  // Note: La création du PaymentIntent se fait normalement côté serveur
  // Cette fonction est un placeholder pour une future implémentation
};

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

// pas d'export par défaut: les fonctions sont déjà exportées individuellement
