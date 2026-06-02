import "dotenv/config";

/**
 * Handlers Express HelloAsso (OAuth2 Client Credentials).
 *
 * Statut : BRANCHÉ. Les handlers sont montés dans les deux serveurs :
 *   - `server/dev-server.js` (l.8, 88-92) : 5 routes, dont `/api/helloasso/orgs`
 *     (diagnostic, dev uniquement).
 *   - `server/prod-server.js` (l.9, 76-79) : 4 routes (sans le diagnostic).
 *
 *   Routes :
 *     GET  /api/helloasso/token
 *     POST /api/helloasso/checkout-intent
 *     GET  /api/helloasso/callback
 *     GET  /api/helloasso/checkout-status/:checkoutIntentId
 *     GET  /api/helloasso/orgs            (dev uniquement — diagnostic)
 *
 * Exporte : `helloassoTokenHandler`, `helloassoCheckoutIntentHandler`,
 *   `helloassoCallbackHandler`, `helloassoCheckoutStatusHandler`,
 *   `helloassoDiagnosticHandler`.
 *
 * Alternative de paiement : Stripe (`StripePaymentForm`), indépendante de ce fichier.
 *
 * Endpoint backend pour créer un checkout-intent HelloAsso.
 * Flux: Frontend → Ce endpoint → API HelloAsso → URL paiement.
 *
 * Utilise OAuth2 (Client Credentials) pour communiquer avec HelloAsso.
 */

const HELLOASSO_API_BASE = "https://api.helloasso.com/v5";
const HELLOASSO_OAUTH_BASE = "https://api.helloasso.com";
const DEFAULT_TEST_CLIENT_ID = "4bed6d3fdebe4e66946bc90887ed33ff";
const DEFAULT_TEST_CLIENT_SECRET = "test_secret_placeholder";

// Credentials HelloAsso (source .env)
const HELLOASSO_CLIENT_ID = process.env.HELLOASSO_CLIENT_ID || DEFAULT_TEST_CLIENT_ID;
const HELLOASSO_CLIENT_SECRET = process.env.HELLOASSO_CLIENT_SECRET || DEFAULT_TEST_CLIENT_SECRET;
const hasRealHelloAssoCredentials = Boolean(
  process.env.HELLOASSO_CLIENT_ID && process.env.HELLOASSO_CLIENT_SECRET
);
const explicitHelloAssoDevMode = ["1", "true", "yes", "on"].includes(
  String(process.env.HELLOASSO_DEV_MODE || "").toLowerCase()
);
// Dev mode actif uniquement si explicitement force, ou si les credentials reels sont absents.
const HELLOASSO_DEV_MODE = explicitHelloAssoDevMode || !hasRealHelloAssoCredentials;
const HELLOASSO_ORGANIZATION_SLUG =
  process.env.HELLOASSO_ORGANIZATION_SLUG ||
  process.env.HELLOASSO_ORGANIZATION_ID ||
  process.env.VITE_HELLOASSO_ORGANIZATION_SLUG ||
  "";
const HELLOASSO_PUBLIC_BASE_URL =
  process.env.HELLOASSO_PUBLIC_BASE_URL ||
  process.env.PUBLIC_BASE_URL ||
  process.env.APP_BASE_URL ||
  process.env.NGROK_URL ||
  process.env.VITE_PUBLIC_BASE_URL ||
  process.env.VITE_NGROK_URL ||
  "";

function normalizeBaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  try {
    const url = new URL(rawUrl.trim());
    return url.origin.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function isLocalHostname(hostname) {
  if (!hostname) return true;
  const lowered = String(hostname).toLowerCase();
  return (
    lowered === "localhost" ||
    lowered === "127.0.0.1" ||
    lowered === "0.0.0.0" ||
    lowered === "::1" ||
    lowered.endsWith(".local")
  );
}

function isPublicHttpsBaseUrl(baseUrl) {
  if (!baseUrl) return false;

  try {
    const url = new URL(baseUrl);
    return url.protocol === "https:" && !isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

function resolveHelloAssoPublicBaseUrl(context = {}) {
  const requestRefererOrigin = normalizeBaseUrl(context.requestReferer);
  const candidates = [
    { source: "HELLOASSO_PUBLIC_BASE_URL", value: HELLOASSO_PUBLIC_BASE_URL },
    { source: "requestPublicBaseUrl", value: context.requestPublicBaseUrl || "" },
    { source: "headerPublicBaseUrl", value: context.headerPublicBaseUrl || "" },
    { source: "requestOrigin", value: context.requestOrigin || "" },
    { source: "requestReferer", value: requestRefererOrigin },
    { source: "requestBaseUrl", value: context.requestBaseUrl || "" },
  ].map((candidate) => ({
    ...candidate,
    normalized: normalizeBaseUrl(candidate.value),
  }));

  const selected = candidates.find((candidate) => isPublicHttpsBaseUrl(candidate.normalized));

  return {
    selectedUrl: selected?.normalized || "",
    selectedSource: selected?.source || "",
    candidates,
  };
}

// Cache du token d'accès HelloAsso (simple cache mémoire, à remplacer par Redis en prod)
let cachedAccessToken = null;
let tokenExpiresAt = null;

/**
 * Obtient un token d'accès HelloAsso via OAuth2 (Client Credentials)
 */
const HELLOASSO_OAUTH_TOKEN_URL = process.env.HELLOASSO_OAUTH_TOKEN_URL || "";
const HELLOASSO_OAUTH_FALLBACK_URLS = [
  HELLOASSO_OAUTH_TOKEN_URL,
  `${HELLOASSO_OAUTH_BASE}/oauth2/token`,
  `${HELLOASSO_API_BASE}/oauth2/token`,
  "https://api.helloasso-sandbox.com/oauth2/token",
].filter(Boolean);

async function getHelloAssoAccessToken() {
  // Vérifier si le token est encore valide
  if (cachedAccessToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  try {
    console.log("🔐 Récupération token OAuth2 HelloAsso...");

    const formData = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: HELLOASSO_CLIENT_ID,
      client_secret: HELLOASSO_CLIENT_SECRET,
    });

    let lastErrorMessage = "";

    for (const tokenUrl of HELLOASSO_OAUTH_FALLBACK_URLS) {
      try {
        const response = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: formData.toString(),
        });

        const responseText = await response.text();

        if (!response.ok) {
          lastErrorMessage = `OAuth2 ${response.status} via ${tokenUrl}: ${responseText.slice(0, 240)}`;
          console.warn(`⚠️ Token URL KO: ${lastErrorMessage}`);

          // 400/401 = credentials invalides, inutile de retenter d'autres URLs.
          if (response.status === 400 || response.status === 401) {
            throw new Error(lastErrorMessage);
          }

          continue;
        }

        const data = JSON.parse(responseText);
        cachedAccessToken = data.access_token;
        tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

        console.log(`✅ Token OAuth2 HelloAsso obtenu via ${tokenUrl}`);
        return cachedAccessToken;
      } catch (innerError) {
        lastErrorMessage = innerError instanceof Error ? innerError.message : String(innerError);
        console.warn(`⚠️ Tentative token échouée (${tokenUrl}): ${lastErrorMessage}`);
      }
    }

    throw new Error(lastErrorMessage || "HelloAsso OAuth2 failed: aucune URL token valide");
  } catch (error) {
    console.error("❌ Impossible d'obtenir le token HelloAsso:", error);
    throw error;
  }
}

/**
 * Crée un checkout-intent HelloAsso
 */
async function createHelloAssoCheckoutIntent(paymentData, requestContext = {}) {
  try {
    console.log(`createHelloAssoCheckoutIntent appelée, HELLOASSO_DEV_MODE=${HELLOASSO_DEV_MODE}`);

    // Mode mock uniquement si credentials absents; si credentials présents, même en local on force l'API réelle.
    if (HELLOASSO_DEV_MODE) {
      console.log("🧪 MODE MOCK: Simulation d'un checkout HelloAsso...");
      const mockCheckoutId = `che_test_${Date.now()}`;
      const mockCheckoutUrl = `http://localhost:5173/test-payment/${mockCheckoutId}`;

      return {
        checkoutIntentId: mockCheckoutId,
        checkoutIntentUrl: mockCheckoutUrl,
        initialAmount: paymentData.amount * 100,
      };
    }

    const accessToken = await getHelloAssoAccessToken();
    const resolvedBaseUrl = resolveHelloAssoPublicBaseUrl(requestContext);
    const appBaseUrl = resolvedBaseUrl.selectedUrl;

    if (!appBaseUrl) {
      throw new Error(
        `Aucune URL publique HTTPS valide pour HelloAsso. Configurez HELLOASSO_PUBLIC_BASE_URL=https://votre-domaine-public ou ouvrez le site via une URL publique HTTPS (ngrok). Candidats testés: ${resolvedBaseUrl.candidates
          .map((candidate) => `${candidate.source}=${candidate.normalized || candidate.value || "<vide>"}`)
          .join(", ")}`
      );
    }

    const callbackBaseUrl = `${appBaseUrl}/api/helloasso/callback`;

    console.log("🌍 URL publique HelloAsso retenue:", {
      source: resolvedBaseUrl.selectedSource,
      appBaseUrl,
      callbackBaseUrl,
    });

    if (!HELLOASSO_ORGANIZATION_SLUG) {
      throw new Error(
        "HELLOASSO_ORGANIZATION_SLUG manquant: impossible de creer un checkout intent reel"
      );
    }

    const response = await fetch(
      `${HELLOASSO_API_BASE}/organizations/${encodeURIComponent(HELLOASSO_ORGANIZATION_SLUG)}/checkout-intents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          totalAmount: paymentData.amount * 100,
          initialAmount: paymentData.amount * 100,
          itemName: paymentData.projectName,
          itemDescription: `Cagnotte: ${paymentData.milestoneIds.join(", ")}`,
          // Callback réel côté backend, puis postMessage à la fenêtre parente
          backUrl: `${callbackBaseUrl}?status=cancel`,
          errorUrl: `${callbackBaseUrl}?status=error`,
          returnUrl: `${callbackBaseUrl}?status=return`,
          containsDonation: true,
          metadata: {
            projectId: paymentData.projectId,
            projectName: paymentData.projectName,
            milestoneIds: paymentData.milestoneIds,
            contributorType: paymentData.contributorType,
            organizationId: paymentData.organizationId || null,
            timestamp: new Date().toISOString(),
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Erreur création checkout HelloAsso:", errorText);
      console.error("🔍 Debug info:", {
        httpStatus: response.status,
        organizationSlug: HELLOASSO_ORGANIZATION_SLUG,
        url: `${HELLOASSO_API_BASE}/organizations/${encodeURIComponent(HELLOASSO_ORGANIZATION_SLUG)}/checkout-intents`,
        errorBody: errorText.slice(0, 600),
      });
      const shortError = (errorText || "").slice(0, 400);
      throw new Error(`Checkout creation failed: ${response.status}${shortError ? ` - ${shortError}` : ""}`);
    }

    const checkoutData = await response.json();

    return {
      checkoutIntentId: checkoutData.id,
      checkoutIntentUrl: checkoutData.checkoutIntentUrl,
      initialAmount: checkoutData.initialAmount,
    };
  } catch (error) {
    console.error("❌ Erreur création checkout HelloAsso:", error);
    throw error;
  }
}

async function getCheckoutIntentStatus(checkoutIntentId) {
  const accessToken = await getHelloAssoAccessToken();
  const response = await fetch(`${HELLOASSO_API_BASE}/checkout-intents/${checkoutIntentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HelloAsso checkout status failed: ${response.status}`);
  }

  return response.json();
}

function renderCallbackHtml(payload) {
  const safePayload = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>HelloAsso callback</title>
</head>
<body>
  <script>
    (function () {
      var payload = ${safePayload};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, "*");
        }
      } catch (e) {
        console.error("postMessage callback error", e);
      }
      setTimeout(function () { window.close(); }, 200);
    })();
  </script>
  <p>Paiement traite. Vous pouvez fermer cette fenetre.</p>
</body>
</html>`;
}

/**
 * Callback réel HelloAsso appelé après le paiement.
 * GET /api/helloasso/callback
 */
export async function helloassoCallbackHandler(req, res) {
  const checkoutIntentId =
    req.query?.checkoutIntentId ||
    req.query?.checkoutIntentPublicId ||
    req.query?.id ||
    "";
  const fallbackStatus = req.query?.status || "return";

  let payload = {
    source: "helloasso",
    type: "HELLOASSO_CALLBACK",
    status: fallbackStatus,
    verified: false,
    checkoutIntentId,
  };

  try {
    if (!HELLOASSO_DEV_MODE && checkoutIntentId) {
      const checkout = await getCheckoutIntentStatus(checkoutIntentId);
      const mapped = mapCheckoutState(checkout?.state);
      payload = {
        ...payload,
        status: mapped.status,
        verified: true,
      };
    }
  } catch (error) {
    console.error("❌ Erreur callback HelloAsso:", error);
    payload = {
      ...payload,
      status: "error",
      verified: false,
      error: error instanceof Error ? error.message : "callback verification failed",
    };
  }

  res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(renderCallbackHtml(payload));
}

/**
 * Endpoint pour obtenir un token d'accès HelloAsso (lecture seule, sans secret)
 * À utiliser côté frontend pour vérifier le statut des paiements
 * GET /api/helloasso/token
 */
export async function helloassoTokenHandler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const accessToken = await getHelloAssoAccessToken();
    return res.status(200).json({
      access_token: accessToken,
      token_type: "Bearer",
    });
  } catch (error) {
    console.error("❌ Erreur endpoint token:", error);
    return res.status(500).json({
      error: "Failed to get access token",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Endpoint Express/Vite-SSR pour créer un checkout-intent
 * POST /api/helloasso/checkout-intent
 * Body: { amount, projectName, projectId, milestoneIds, contributorType, organizationId? }
 */
export async function helloassoCheckoutIntentHandler(req, res) {
  console.log("🎯 helloassoCheckoutIntentHandler appelé - Method:", req.method, "URL:", req.url);

  if (req.method !== "POST") {
    console.log("❌ Méthode non autorisée:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("📦 Body reçu:", JSON.stringify(req.body, null, 2));
    const {
      amount,
      projectName,
      projectId,
      milestoneIds,
      contributorType,
      organizationId,
      publicBaseUrl,
    } = req.body;

    // Validation basique
    if (!amount || !projectName || !projectId || !milestoneIds || !contributorType) {
      console.log("❌ Champs manquants dans la requête");
      return res.status(400).json({
        error: "Missing required fields",
        required: ["amount", "projectName", "projectId", "milestoneIds", "contributorType"],
      });
    }

    console.log("✅ Validation OK, cration du checkout...");
    // Construire l'URL de base depuis la requête entrante (supporte ngrok, localhost, etc.)
    const protocol = String(req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http"))
      .split(",")[0]
      .trim();
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173")
      .split(",")[0]
      .trim();
    const requestBaseUrl = `${protocol}://${host}`;
    const requestOrigin = String(req.headers.origin || "").split(",")[0].trim();
    const requestReferer = String(req.headers.referer || "").split(",")[0].trim();
    const headerPublicBaseUrl = String(req.headers["x-public-base-url"] || "").split(",")[0].trim();
    console.log("🌐 Contexte URL checkout détecté:", {
      requestBaseUrl,
      requestOrigin,
      requestReferer,
      requestPublicBaseUrl: publicBaseUrl || null,
      headerPublicBaseUrl: headerPublicBaseUrl || null,
      configuredPublicBaseUrl: HELLOASSO_PUBLIC_BASE_URL || null,
    });
    const checkout = await createHelloAssoCheckoutIntent({
      amount,
      projectName,
      projectId,
      milestoneIds,
      contributorType,
      organizationId,
    }, {
      requestBaseUrl,
      requestOrigin,
      requestReferer,
      requestPublicBaseUrl: publicBaseUrl,
      headerPublicBaseUrl,
    });
    console.log("✅ Checkout créé, envoi de la réponse:", checkout);
    return res.status(200).json({
      success: true,
      checkoutIntentId: checkout.checkoutIntentId,
      checkoutIntentUrl: checkout.checkoutIntentUrl,
      initialAmount: checkout.initialAmount,
      totalAmount: checkout.initialAmount,
    });
  } catch (error) {
    console.error("❌ Erreur endpoint checkout:", error);
    return res.status(500).json({
      error: "Failed to create checkout intent",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Endpoint backend pour verifier le statut du checkout HelloAsso
 * GET /api/helloasso/checkout-status/:checkoutIntentId
 */
export async function helloassoCheckoutStatusHandler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const checkoutIntentId = req.params?.checkoutIntentId || req.query?.checkoutIntentId;

  if (!checkoutIntentId) {
    return res.status(400).json({
      isValid: false,
      status: "error",
      error: "checkoutIntentId is required",
    });
  }

  try {
    if (HELLOASSO_DEV_MODE && String(checkoutIntentId).startsWith("che_test_")) {
      return res.status(200).json({
        isValid: true,
        status: "success",
        checkoutData: {
          id: checkoutIntentId,
          state: "Completed",
        },
      });
    }

    const checkoutData = await getCheckoutIntentStatus(String(checkoutIntentId));
    const mapped = mapCheckoutState(checkoutData?.state);

    return res.status(200).json({
      ...mapped,
      checkoutData,
      error: mapped.status === "error" ? `Unknown state: ${checkoutData?.state}` : undefined,
    });
  } catch (error) {
    console.error("❌ Erreur endpoint checkout-status:", error);
    return res.status(500).json({
      isValid: false,
      status: "error",
      error: error instanceof Error ? error.message : "Checkout status verification failed",
    });
  }
}

function mapCheckoutState(checkoutState) {
  if (checkoutState === "Completed") {
    return { isValid: true, status: "success" };
  }

  if (checkoutState === "Started" || checkoutState === "Processing") {
    return { isValid: false, status: "pending" };
  }

  if (checkoutState === "Canceled" || checkoutState === "Failed") {
    return { isValid: false, status: "failed" };
  }

  return { isValid: false, status: "error" };
}

/**
 * Endpoint de diagnostic: liste les organisations HelloAsso accessibles
 * GET /api/helloasso/orgs
 */
export async function helloassoDiagnosticHandler(req, res) {
  try {
    const accessToken = await getHelloAssoAccessToken();

    // Essayer plusieurs endpoints pour lister les orgs
    const endpoints = [
      `${HELLOASSO_API_BASE}/users/me/organizations`,
      `${HELLOASSO_API_BASE}/organizations`,
    ];

    const results = {};
    for (const url of endpoints) {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      const text = await r.text();
      results[url] = { status: r.status, body: text.slice(0, 1000) };
    }

    return res.status(200).json({
      configured: isHelloAssoConfigured(),
      devMode: HELLOASSO_DEV_MODE,
      organizationSlug: HELLOASSO_ORGANIZATION_SLUG,
      clientId: HELLOASSO_CLIENT_ID.slice(0, 8) + "...",
      results,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export default {
  createHelloAssoCheckoutIntent,
  getHelloAssoAccessToken,
  helloassoCheckoutIntentHandler,
  helloassoCallbackHandler,
  helloassoCheckoutStatusHandler,
  helloassoDiagnosticHandler,
};

