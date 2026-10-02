import { describe, expect, it } from "vitest";
import { availablePaymentChoices } from "./paymentMethods";

describe("availablePaymentChoices", () => {
  it("ne propose que les moyens configurés pour l'entité", () => {
    const configured = { stripe: false, helloasso: true, stripePublicKey: "pk_test_x" };

    expect(availablePaymentChoices(configured, { stripePublicKey: "pk_test_x" })).toEqual(["helloasso"]);
  });

  it("exige une clé publique pour proposer Stripe", () => {
    expect(availablePaymentChoices({ stripe: true }, { stripePublicKey: "" })).toEqual([]);
    expect(availablePaymentChoices({ stripe: true }, { stripePublicKey: "pk_test_x" })).toEqual(["stripe"]);
  });

  it("ajoute la promesse quand le type de cagnotte l'autorise", () => {
    expect(
      availablePaymentChoices({ stripe: true, helloasso: true }, { stripePublicKey: "pk_test_x", allowPledge: true }),
    ).toEqual(["stripe", "helloasso", "pledge"]);
  });

  it("ne propose aucun moyen payant sans enveloppe", () => {
    expect(availablePaymentChoices(null, { stripePublicKey: "pk_test_x" })).toEqual([]);
    expect(availablePaymentChoices(null, { stripePublicKey: "pk_test_x", allowPledge: true })).toEqual(["pledge"]);
  });
});
