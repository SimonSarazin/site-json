import { describe, expect, it } from "vitest";
import { isUnknownOutcome, readFundingEnvelopeError, readFundingEnvelopeResponse } from "./fundingEnvelopeResponse";

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

  it("une authentification forte demandée (`requires_action`) est une réponse, pas une erreur", () => {
    const response = { success: 1, requires_action: true, client_secret: "pi_1_secret_2", bill: "b1" };

    expect(readFundingEnvelopeResponse(response, REPLI)).toEqual(response);
  });

  it("garde le repli quand le serveur échoue sans message", () => {
    expect(() => readFundingEnvelopeResponse({ success: 0, content: null }, REPLI)).toThrow(REPLI);
  });

  it("un succès dont le `message` parle d'erreur reste un succès", () => {
    const response = { success: 1, paid: true, recorded: false, recordError: "depense not found", message: "Payment settled with record error" };

    expect(readFundingEnvelopeResponse(response, REPLI)).toEqual(response);
  });
});

describe("readFundingEnvelopeError", () => {
  it("erreur HTTP du SDK : message du corps de réponse, statut gardé", () => {
    const erreurSdk = Object.assign(new Error("Erreur lors de l'appel de l'API : Request failed with status code 400"), {
      status: 400,
      details: { error: "Your card was declined." },
    });

    const erreur = readFundingEnvelopeError(erreurSdk);

    expect(erreur).toBeInstanceOf(Error);
    expect((erreur as Error).message).toBe("Your card was declined.");
    expect(erreur).toMatchObject({ status: 400 });
  });

  it("sans corps exploitable (coupure réseau) : l'erreur du SDK telle quelle", () => {
    const coupure = Object.assign(new Error("Network Error"), { status: 500, details: null });

    expect(readFundingEnvelopeError(coupure)).toBe(coupure);
  });
});

describe("isUnknownOutcome", () => {
  it("5xx ou pas de réponse (500 côté SDK) : le paiement a pu passer", () => {
    expect(isUnknownOutcome(Object.assign(new Error("Network Error"), { status: 500 }))).toBe(true);
    expect(isUnknownOutcome(Object.assign(new Error("Service Unavailable"), { status: 503 }))).toBe(true);
  });

  it("refus 4xx ou réponse d'erreur du serveur : aucun débit", () => {
    expect(isUnknownOutcome(Object.assign(new Error("Your card was declined."), { status: 400 }))).toBe(false);
    expect(isUnknownOutcome(new Error("Cette organisation n'a pas encore de clé API stripe"))).toBe(false);
  });
});
