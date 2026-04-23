/**
 * Service de création de checkout-intent HelloAsso
 * Appelle le backend pour créer une session de paiement réelle via API HelloAsso
 */

export interface CreateCheckoutIntentRequest {
  amount: number;
  projectName: string;
  projectId: string;
  milestoneIds: string[];
  contributorType: "citoyens" | "organizations";
  organizationId?: string;
  publicBaseUrl?: string;
}

export interface CreateCheckoutIntentResponse {
  success: boolean;
  checkoutIntentId: string;
  checkoutIntentUrl: string;
  totalAmount: number;
  error?: string;
}

function isLocalHostname(hostname: string) {
  const lowered = hostname.toLowerCase();
  return (
    lowered === "localhost" ||
    lowered === "127.0.0.1" ||
    lowered === "0.0.0.0" ||
    lowered === "::1" ||
    lowered.endsWith(".local")
  );
}

function getHelloAssoPublicBaseUrl() {
  const viteEnv = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;
  const candidates = [
    viteEnv.VITE_HELLOASSO_PUBLIC_BASE_URL,
    viteEnv.VITE_PUBLIC_BASE_URL,
    viteEnv.VITE_NGROK_URL,
    typeof window !== "undefined" ? window.location.origin : "",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" && !isLocalHostname(url.hostname)) {
        return url.origin;
      }
    } catch {
      // Ignore les URLs invalides
    }
  }

  return "";
}

/**
 * Appelle le backend pour créer un checkout-intent HelloAsso
 */
export const createHelloAssoCheckoutIntent = async (
  request: CreateCheckoutIntentRequest
): Promise<CreateCheckoutIntentResponse> => {
  try {
    const publicBaseUrl = request.publicBaseUrl || getHelloAssoPublicBaseUrl();
    const payload = {
      ...request,
      ...(publicBaseUrl ? { publicBaseUrl } : {}),
    };

    console.log("🛒 Création checkout-intent via backend...", payload);

    const response = await fetch("/api/helloasso/checkout-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(publicBaseUrl ? { "X-Public-Base-Url": publicBaseUrl } : {}),
      },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      if (contentType.includes("application/json")) {
        const errorData = await response.json();
        console.error("❌ Erreur création checkout:", errorData);
        throw new Error(errorData.message || `Checkout creation failed: ${response.status}`);
      }

      const rawBody = await response.text();
      console.error("❌ Erreur création checkout (non JSON):", rawBody.slice(0, 300));
      throw new Error(`Checkout creation failed: ${response.status}`);
    }

    if (!contentType.includes("application/json")) {
      const rawBody = await response.text();
      console.error("❌ Reponse checkout-intent non JSON:", rawBody.slice(0, 300));
      throw new Error("Reponse invalide du serveur checkout-intent");
    }

    const data = await response.json();
    console.log("✅ Checkout-intent créé:", {
      id: data.checkoutIntentId,
      url: data.checkoutIntentUrl,
    });

    return {
      success: true,
      checkoutIntentId: data.checkoutIntentId,
      checkoutIntentUrl: data.checkoutIntentUrl,
      totalAmount: data.totalAmount,
    };
  } catch (error) {
    console.error("❌ Erreur création checkout-intent:", error);
    return {
      success: false,
      checkoutIntentId: "",
      checkoutIntentUrl: "",
      totalAmount: 0,
      error: error instanceof Error ? error.message : "Erreur lors de la création du checkout",
    };
  }
};

/**
 * Ouvre la popup de paiement HelloAsso avec l'URL officielle du checkout
 */
export const openHelloAssoPaymentWithCheckout = (
  checkoutIntentUrl: string,
  popupConfig?: { width?: number; height?: number; left?: number; top?: number }
): Promise<{ success: boolean; popup: Window | null }> => {
  return new Promise((resolve) => {
    const config = {
      width: 680,
      height: 760,
      left: 120,
      top: 60,
      ...popupConfig,
    };

    const popupParams = [
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

    console.log("🌐 Ouverture popup HelloAsso:", checkoutIntentUrl);

    const popup = window.open(checkoutIntentUrl, "helloasso-payment", popupParams);

    if (!popup) {
      console.error("❌ Impossible d'ouvrir la popup HelloAsso");
      resolve({ success: false, popup: null });
      return;
    }

    console.log("✅ Popup HelloAsso ouverte, attente du callback réel...");
    resolve({ success: true, popup });
  });
};

export default {
  createHelloAssoCheckoutIntent,
  openHelloAssoPaymentWithCheckout,
};
