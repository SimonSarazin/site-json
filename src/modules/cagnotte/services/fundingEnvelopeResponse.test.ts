import { describe, expect, it } from "vitest";
import { readFundingEnvelopeResponse } from "./fundingEnvelopeResponse";

const REPLI = "Le paiement n'a pas abouti.";

describe("readFundingEnvelopeResponse", () => {
  it("rend un succès tel quel", () => {
    const response = { success: 1, content: { id: 42, redirectUrl: "https://www.helloasso-sandbox.com/x" } };

    expect(readFundingEnvelopeResponse(response, REPLI)).toEqual(response);
  });

  it("accepte une réponse sérialisée en chaîne", () => {
    expect(readFundingEnvelopeResponse('{"success":1,"paid":true}', REPLI)).toEqual({ success: 1, paid: true });
  });

  it("lève le message serveur d'un `{success: 0, content}`", () => {
    const response = { success: 0, content: "Cette organisation n'a pas encore de clé API helloasso" };

    expect(() => readFundingEnvelopeResponse(response, REPLI)).toThrow(
      "Cette organisation n'a pas encore de clé API helloasso",
    );
  });

  it("lève les erreurs HelloAsso relayées dans `content.errors`", () => {
    const response = {
      success: 0,
      content: {
        errors: [
          { code: "ArgumentInvalid", message: "returnUrl doit être en https" },
          { message: "backUrl doit être en https" },
        ],
      },
    };

    expect(() => readFundingEnvelopeResponse(response, REPLI)).toThrow(
      "returnUrl doit être en https | backUrl doit être en https",
    );
  });

  it("lève le `message` d'un `{error: true, message}`", () => {
    const response = { error: true, message: "Cette organisation n'a pas encore de clé API stripe" };

    expect(() => readFundingEnvelopeResponse(response, REPLI)).toThrow(
      "Cette organisation n'a pas encore de clé API stripe",
    );
  });

  it("lève l'erreur Stripe portée par `error`", () => {
    expect(() => readFundingEnvelopeResponse({ error: "Your card was declined." }, REPLI)).toThrow(
      "Your card was declined.",
    );
  });

  it("ne prend pas une authentification 3-D Secure en attente pour un paiement réussi", () => {
    const response = { error: true, requires_action: true, client_secret: "pi_1_secret_2" };

    expect(() => readFundingEnvelopeResponse(response, REPLI)).toThrow(REPLI);
  });

  it("garde le repli quand le serveur échoue sans message", () => {
    expect(() => readFundingEnvelopeResponse({ success: 0, content: null }, REPLI)).toThrow(REPLI);
  });
});
