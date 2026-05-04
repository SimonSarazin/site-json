import { getBaseUrl, getServerUrl } from "@/lib/constant/common";

export type FundingEnvelopePaymentAction = "stripePay" | "helloassoPay";

export interface FundingEnvelopePaymentRequest {
  contextId: string;
  contextType: string;
  action: FundingEnvelopePaymentAction;
  amount: number;
  payment_method_id?: string;
  email?: string;
}

export interface FundingEnvelopePaymentResponse {
  success: boolean;
  redirectUrl?: string;
  checkoutIntentUrl?: string;
  url?: string;
  paymentMethods?: Record<string, unknown>;
  raw?: unknown;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function resolveApiBaseUrl(): string {
  const candidates = [
    getServerUrl(),
    getBaseUrl(),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);

      // En local, on évite de taper le serveur Vite 5173 qui renvoie du HTML.
      if (
        typeof window !== "undefined" &&
        window.location.hostname === parsed.hostname &&
        (parsed.port === "5173" || window.location.port === "5173")
      ) {
        continue;
      }

      return parsed.toString().replace(/\/$/, "");
    } catch {
      // On continue avec le candidat suivant.
    }
  }

  if (typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:5080`;
  }

  return "http://localhost:5080";
}

function getFundingEnvelopeUrl(): string {
  const baseUrl = resolveApiBaseUrl();

  return new URL("/co2/aap/fundingenvelope/", baseUrl).toString();
}

export async function submitFundingEnvelopePayment(
  payload: FundingEnvelopePaymentRequest
): Promise<FundingEnvelopePaymentResponse> {
  const response = await fetch(getFundingEnvelopeUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const errorData = await response.json();
      const message =
        (isRecord(errorData) &&
          (typeof errorData.message === "string"
            ? errorData.message
            : typeof errorData.error === "string"
              ? errorData.error
              : undefined)) ||
        `Funding envelope payment failed: ${response.status}`;
      throw new Error(message);
    }

    const rawBody = await response.text();
    throw new Error(`Funding envelope payment failed: ${response.status} - ${rawBody.slice(0, 300)}`);
  }

  if (!contentType.includes("application/json")) {
    const rawBody = await response.text();
    throw new Error(
      `Invalid funding envelope response from ${response.url || getFundingEnvelopeUrl()}: ${rawBody.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const redirectUrl =
    typeof data.redirectUrl === "string"
      ? data.redirectUrl
      : typeof data.checkoutIntentUrl === "string"
        ? data.checkoutIntentUrl
        : typeof data.url === "string"
          ? data.url
          : undefined;

  return {
    success: true,
    redirectUrl,
    checkoutIntentUrl: typeof data.checkoutIntentUrl === "string" ? data.checkoutIntentUrl : undefined,
    url: typeof data.url === "string" ? data.url : undefined,
    paymentMethods: isRecord(data.paymentMethods) ? data.paymentMethods : undefined,
    raw: data,
  };
}

