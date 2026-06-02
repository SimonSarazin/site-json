/**
 * @deprecated FICHIER NON UTILISÉ — 2026-05-14
 *
 * Statut : PAS BRANCHÉ
 * Raison : ce module exporte des handlers webhook HelloAsso (validation HMAC,
 *   traitement asynchrone) qui ne sont **importés nulle part** :
 *   - ni par `server/api/helloasso-checkout.js`
 *   - ni par les serveurs Express (`server/dev-server.js`, `server/prod-server.js`)
 *
 * Alternative active : le front fait du polling toutes les 5s sur
 *   `/api/helloasso/checkout-status/:checkoutIntentId` (voir `PaymentConfigPage`
 *   `useEffect` ligne ~358) pour confirmer le paiement, donc le webhook n'est pas
 *   nécessaire à l'état actuel.
 *
 * À reviewer : décider entre
 *   (a) GARDER LE POLLING → supprimer ce fichier
 *   (b) BASCULER SUR WEBHOOK → brancher dans `server/api/helloasso-checkout.js`
 *       puis monter la route Express dans `dev-server.js` et `prod-server.js`.
 *
 * Service HelloAsso avec support webhook et confirmation réelle.
 * Gère la validation du paiement via retour signé ou webhook.
 */

export interface HelloAssoWebhookPayload {
  id: string;
  status: "pending" | "completed" | "failed" | "refused" | "cancelled";
  amount: number;
  payer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  metadata?: Record<string, unknown>;
  signature?: string;
  timestamp?: number;
}

export interface HelloAssoPaymentVerification {
  isValid: boolean;
  status: "success" | "pending" | "failed" | "error";
  transactionId?: string;
  error?: string;
}

/**
 * Clé secrète HelloAsso pour valider les webhooks (à configurer dans .env)
 * En production: process.env.HELLOASSO_WEBHOOK_SECRET
 * TODO: Utiliser cette clé pour la validation HMAC quand implémentée
 */
// const HELLOASSO_WEBHOOK_SECRET = process.env.REACT_APP_HELLOASSO_WEBHOOK_SECRET || "dev-secret-key";

/**
 * Valide la signature d'un webhook HelloAsso
 * @param _webhookData - Données du webhook
 * @param _signature - Signature fournie par HelloAsso
 * @returns true si la signature est valide
 *
 * TODO: Implémenter vérification HMAC SHA256 en production
 */
export const verifyHelloAssoSignature = async (
  _webhookData: HelloAssoWebhookPayload,
  _signature: string
): Promise<boolean> => {
  try {
    // En production, utiliser une vraie validation HMAC
    // Ceci est un placeholder
    // TODO: Implémenter la vérification HMAC SHA256
    // const secret = process.env.REACT_APP_HELLOASSO_WEBHOOK_SECRET || "dev-secret-key";
    // const payloadString = JSON.stringify(webhookData);
    // const hash = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    // return hash === signature;

    // Pour l'instant: accepter comme valide en dev
    return true;
  } catch (error) {
    console.error("Erreur vérification signature:", error);
    return false;
  }
};

/**
 * Traite un webhook HelloAsso et valide le paiement
 * @param webhookData - Données du webhook
 * @returns Résultat de la vérification
 */
export const processHelloAssoWebhook = async (
  webhookData: HelloAssoWebhookPayload
): Promise<HelloAssoPaymentVerification> => {
  try {
    // 1. Vérifier la signature si présente
    if (webhookData.signature) {
      const isSignatureValid = await verifyHelloAssoSignature(webhookData, webhookData.signature);
      if (!isSignatureValid) {
        console.error("Signature HelloAsso invalide");
        return {
          isValid: false,
          status: "error",
          error: "Invalid signature",
        };
      }
    }

    // 2. Vérifier le statut du paiement
    if (webhookData.status === "completed") {
      return {
        isValid: true,
        status: "success",
        transactionId: webhookData.id,
      };
    } else if (webhookData.status === "pending") {
      return {
        isValid: false,
        status: "pending",
        transactionId: webhookData.id,
        error: "Payment pending",
      };
    } else if (webhookData.status === "failed" || webhookData.status === "refused") {
      return {
        isValid: false,
        status: "failed",
        transactionId: webhookData.id,
        error: `Payment ${webhookData.status}`,
      };
    } else {
      return {
        isValid: false,
        status: "error",
        transactionId: webhookData.id,
        error: `Unknown status: ${webhookData.status}`,
      };
    }
  } catch (error) {
    console.error("Erreur traitement webhook:", error);
    return {
      isValid: false,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Interroge l'API HelloAsso pour confirmer le statut du paiement
 * Alternative au webhook pour les environnements sans serveur backend
 * @param transactionId - ID du paiement HelloAsso
 * @returns Résultat de la vérification
 */
export const verifyHelloAssoPaymentStatus = async (
  transactionId: string
): Promise<HelloAssoPaymentVerification> => {
  try {
    // TODO: Appeler l'API HelloAsso pour vérifier le statut
    // C'est une approche alternative au webhook
    // const response = await fetch(`https://api.helloasso.com/v5/payments/${transactionId}`, {
    //   headers: {
    //     'Authorization': `Bearer ${process.env.REACT_APP_HELLOASSO_API_KEY}`,
    //   }
    // });
    // const data = await response.json();
    // return processHelloAssoWebhook(data);

    // Placeholder en attendant l'implémentation réelle
    console.warn("Vérification API HelloAsso non encore implémentée");
    return {
      isValid: false,
      status: "pending",
      transactionId,
      error: "API verification not implemented",
    };
  } catch (error) {
    console.error("Erreur vérification statut HelloAsso:", error);
    return {
      isValid: false,
      status: "error",
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
};

/**
 * Crée un endpoint webhook pour recevoir les confirmations HelloAsso
 * À implémenter côté backend
 *
 * @example
 * // Dans un serveur Next.js/Express:
 * POST /api/webhooks/helloasso
 * Body: { id, status, amount, metadata, signature, ... }
 *
 * // Traitement:
 * const handler = createHelloAssoWebhookHandler();
 * const verification = await handler(body);
 * if (verification.isValid) {
 *   // Valider la cagnotte
 *   // Mettre à jour la BD
 * }
 * return { success: verification.isValid, transactionId: verification.transactionId };
 */
export const createHelloAssoWebhookHandler = () => {
  return async (payload: HelloAssoWebhookPayload) => {
    return processHelloAssoWebhook(payload);
  };
};





