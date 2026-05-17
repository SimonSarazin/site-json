/**
 * Service de vérification du statut de paiement HelloAsso via backend
 * Le frontend ne contacte plus directement l'API HelloAsso.
 */

/**
 * Interroge le backend pour obtenir le statut d'un checkout-intent
 */
export const verifyHelloAssoCheckoutStatus = async (
  checkoutIntentId: string
): Promise<{
  isValid: boolean;
  status: "success" | "pending" | "failed" | "error";
  checkoutData?: Record<string, unknown>;
  error?: string;
}> => {
  try {
    const response = await fetch(
      `/api/helloasso/checkout-status/${encodeURIComponent(checkoutIntentId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const rawBody = await response.text();
      console.error("Reponse non JSON depuis checkout-status:", rawBody.slice(0, 300));
      return {
        isValid: false,
        status: "error",
        error: `Reponse invalide du serveur (HTTP ${response.status})`,
      };
    }

    const data = (await response.json()) as {
      isValid?: boolean;
      status?: "success" | "pending" | "failed" | "error";
      checkoutData?: Record<string, unknown>;
      error?: string;
    };

    if (!response.ok) {
      return {
        isValid: false,
        status: "error",
        error: data.error || `API error: ${response.status}`,
      };
    }

    return {
      isValid: Boolean(data.isValid),
      status: data.status || "error",
      checkoutData: data.checkoutData,
      error: data.error,
    };
  } catch (error) {
    console.error("Erreur verification statut checkout:", error);
    return {
      isValid: false,
      status: "error",
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
};
