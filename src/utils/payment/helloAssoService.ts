/**
 * Service HelloAsso pour intégration des paiements
 * Gère les appels API et l'ouverture des popups de paiement
 */

export interface HelloAssoPaymentConfig {
  amount: number;
  projectName: string;
  projectId: string;
  milestoneIds: string[];
  contributorType: "citoyens" | "organizations";
  organizationId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface HelloAssoPopupConfig {
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

// Configuration HelloAsso par défaut
const HELLOASSO_CONFIG = {
  // Association ID pour HelloAsso (à remplacer par l'ID réel)
  associationId: "rezo-la-mer",
  // URL de base HelloAsso
  baseUrl: "https://www.helloasso.com",
  // Formulaire de financement
  formPath: "/associations/rezo-la-mer/formulaires/1",
  // Ouvre directement l'étape paiement (infos carte)
  paymentPathSuffix: "/paiement",
  // Client ID de test HelloAsso
  clientId: "4bed6d3fdebe4e66946bc90887ed33ff",
  // Configuration popup par défaut
  defaultPopupConfig: {
    width: 680,
    height: 760,
    left: 120,
    top: 60,
  } as HelloAssoPopupConfig,
};

/**
 * Crée une URL HelloAsso avec les paramètres de paiement
 */
export const buildHelloAssoUrl = (config: HelloAssoPaymentConfig): URL => {
  const url = new URL(
    `${HELLOASSO_CONFIG.baseUrl}${HELLOASSO_CONFIG.formPath}${HELLOASSO_CONFIG.paymentPathSuffix}`
  );

  // Client ID de test explicitement transmis pour le flux de paiement
  url.searchParams.set("client_id", HELLOASSO_CONFIG.clientId);

  // Ajouter le montant en centimes (HelloAsso utilise les centimes)
  url.searchParams.set("amount", String(config.amount * 100));

  // Ajouter les métadonnées personnalisées
  const metadata = {
    project: config.projectName,
    projectId: config.projectId,
    milestoneIds: config.milestoneIds,
    contributorType: config.contributorType,
    organizationId: config.organizationId || null,
    timestamp: new Date().toISOString(),
  };

  url.searchParams.set("metadata", JSON.stringify(metadata));

  // Ajouter les données personnelles si disponibles
  if (config.email) {
    url.searchParams.set("email", config.email);
  }
  if (config.firstName) {
    url.searchParams.set("firstName", config.firstName);
  }
  if (config.lastName) {
    url.searchParams.set("lastName", config.lastName);
  }

  return url;
};

/**
 * Crée les paramètres de la fenêtre popup
 */
export const buildPopupParams = (customConfig?: Partial<HelloAssoPopupConfig>): string => {
  const config = { ...HELLOASSO_CONFIG.defaultPopupConfig, ...customConfig };

  return [
    `width=${config.width}`,
    `height=${config.height}`,
    `left=${config.left}`,
    `top=${config.top}`,
    "toolbar=no",
    "menubar=no",
    "scrollbars=yes",
    "resizable=yes",
    "status=no",
  ].join(",");
};

/**
 * Ouvre la fenêtre de paiement HelloAsso et retourne une promesse
 * qui se résout quand la fenêtre est fermée
 */
export const openHelloAssoPayment = (
  config: HelloAssoPaymentConfig,
  popupConfig?: Partial<HelloAssoPopupConfig>
): Promise<{ success: boolean; popup: Window | null }> => {
  return new Promise((resolve) => {
    console.log("🌐 Ouverture du paiement HelloAsso:", config);

    const url = buildHelloAssoUrl(config);
    const popupParams = buildPopupParams(popupConfig);

    const popup = window.open(
      url.toString(),
      "helloasso-payment",
      popupParams
    );

    if (!popup) {
      console.error("❌ Impossible d'ouvrir la popup HelloAsso");
      resolve({ success: false, popup: null });
      return;
    }

    console.log("✅ Popup HelloAsso ouverte");

    // Surveiller la fermeture de la popup
    const closeWatcher = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(closeWatcher);
        console.log("✅ Popup HelloAsso fermée - Paiement finalisé");
        resolve({ success: true, popup });
      }
    }, 500);

    // Timeout de sécurité (30 minutes)
    const timeout = window.setTimeout(() => {
      window.clearInterval(closeWatcher);
      if (!popup.closed) {
        popup.close();
      }
      console.warn("⚠️ Timeout popup HelloAsso (30 min)");
      resolve({ success: false, popup });
    }, 30 * 60 * 1000);

    // Ajouter un écouteur pour que le parent sache quand la popup est fermée
    (popup as unknown as { __helloasso_payment_timeout?: ReturnType<typeof setTimeout> }).__helloasso_payment_timeout = timeout;
  });
};

/**
 * Valide la configuration du paiement HelloAsso
 */
export const validateHelloAssoConfig = (
  config: Partial<HelloAssoPaymentConfig>
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.amount || config.amount <= 0) {
    errors.push("Le montant doit être supérieur à 0");
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
  if (config.contributorType === "organization" && !config.organizationId) {
    errors.push("L'ID de l'organisation est requis");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Crée les données de paiement finalisées pour HelloAsso
 */
export const buildHelloAssoPaymentData = (
  config: HelloAssoPaymentConfig,
  transactionId: string
) => ({
  transactionId,
  method: "helloasso" as const,
  amount: config.amount,
  projectName: config.projectName,
  projectId: config.projectId,
  milestones: config.milestoneIds,
  contributorType: config.contributorType,
  organizationId: config.organizationId || null,
  timestamp: new Date().toISOString(),
  status: "pending_confirmation" as const,
});

export default {
  buildHelloAssoUrl,
  buildPopupParams,
  openHelloAssoPayment,
  validateHelloAssoConfig,
  buildHelloAssoPaymentData,
};
