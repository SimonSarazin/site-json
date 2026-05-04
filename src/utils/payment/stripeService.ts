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
 * Valide la configuration du paiement Stripe
 */
export const validateStripeConfig = (
  config: Partial<StripePaymentConfig>
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.amount || config.amount <= 0) {
    errors.push("Le montant doit être supérieur à 0");
  }
  if (config.amount && config.amount > 99999) {
    errors.push("Le montant ne peut pas dépasser 99 999€");
  }
  if (!config.projectName) {
    errors.push("Le nom du projet est requis");
  }
  if (!config.projectId) {
    errors.push("L'ID du projet est requis");
  }
  if (!config.milestoneIds || config.milestoneIds.length === 0) {
    errors.push("Au moins un milestone doit être sélectionné");
  }
  if (!config.contributorType) {
    errors.push("Le type de contributeur doit être spécifié");
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
export const prepareStripePaymentIntent = async (
  stripe: Stripe | null,
  amount: number
) => {
  if (!stripe) {
    throw new Error("Stripe n'est pas initialisé");
  }

  if (amount <= 0) {
    throw new Error("Le montant doit être supérieur à 0");
  }

  // Note: La création du PaymentIntent se fait normalement côté serveur
  // Cette fonction est un placeholder pour une future implémentation
  console.log("💳 Préparation du PaymentIntent Stripe:", {
    amount: formatStripeAmount(amount),
    currency: "eur",
  });
};

/**
 * Messages d'erreur Stripe localisés en français
 */
export const getStripeErrorMessage = (errorCode: string): string => {
  const messages: Record<string, string> = {
    card_declined: "Votre carte a été refusée. Veuillez vérifier vos informations.",
    expired_card: "Votre carte est expirée.",
    incorrect_cvc: "Le code de sécurité (CVC) est incorrect.",
    processing_error: "Une erreur de traitement s'est produite. Veuillez réessayer.",
    rate_limit: "Trop de tentatives. Veuillez attendre quelques secondes.",
    authentication_error: "Erreur d'authentification. Veuillez vérifier vos données.",
    invalid_expiry_month: "Le mois d'expiration est invalide.",
    invalid_expiry_year: "L'année d'expiration est invalide.",
    invalid_number: "Le numéro de carte est invalide.",
  };

  return messages[errorCode] || "Une erreur est survenue lors du paiement. Veuillez réessayer.";
};

// pas d'export par défaut: les fonctions sont déjà exportées individuellement
