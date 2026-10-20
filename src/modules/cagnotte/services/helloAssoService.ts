/**
 * Validation d'un paiement HelloAsso avant l'ouverture du checkout (`useHelloAssoCheckout`).
 */

export interface HelloAssoPaymentConfig {
  amount: number;
  resourceName: string;
  resourceId: string;
  itemsIds: string[];
  contributorType: "citoyens" | "organizations";
  organizationId?: string;
}

/**
 * Codes d'erreur retournés par validateHelloAssoConfig.
 * Les messages traduits sont dans `i18n/{fr,en}.json` sous
 * `PaymentConfigPage.helloAssoConfigErrors.*`.
 */
export type HelloAssoConfigErrorCode =
  | "amountInvalid"
  | "projectNameRequired"
  | "projectIdRequired"
  | "milestoneRequired"
  | "contributorTypeRequired"
  | "organizationIdRequired";

/**
 * Valide la configuration du paiement HelloAsso.
 * Retourne des codes d'erreur stables, à traduire côté UI via
 * `t("PaymentConfigPage.helloAssoConfigErrors." + code)`.
 */
export const validateHelloAssoConfig = (
  config: Partial<HelloAssoPaymentConfig>
): { valid: boolean; errors: HelloAssoConfigErrorCode[] } => {
  const errors: HelloAssoConfigErrorCode[] = [];

  if (!config.amount || config.amount <= 0) {
    errors.push("amountInvalid");
  }
  if (!config.resourceName) {
    errors.push("projectNameRequired");
  }
  if (!config.resourceId) {
    errors.push("projectIdRequired");
  }
  if (!config.itemsIds || config.itemsIds.length === 0) {
    errors.push("milestoneRequired");
  }
  if (!config.contributorType) {
    errors.push("contributorTypeRequired");
  }
  if (config.contributorType === "organizations" && !config.organizationId) {
    errors.push("organizationIdRequired");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
