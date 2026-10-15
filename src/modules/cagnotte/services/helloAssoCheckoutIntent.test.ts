import { describe, expect, it } from "vitest";
import { readHelloAssoCheckout } from "./helloAssoCheckoutIntent";

describe("readHelloAssoCheckout", () => {
  it("lit le checkout sous `content`, forme renvoyée par `helloassoPay`", () => {
    const response = { success: 1, content: { id: 12345, redirectUrl: "https://www.helloasso.com/checkout/abc" } };

    expect(readHelloAssoCheckout(response)).toEqual({
      checkoutIntentId: "12345",
      redirectUrl: "https://www.helloasso.com/checkout/abc",
    });
  });

  it("accepte un checkout posé à la racine", () => {
    expect(readHelloAssoCheckout({ checkoutIntentId: "77", redirectUrl: "https://x.test/pay" })).toEqual({
      checkoutIntentId: "77",
      redirectUrl: "https://x.test/pay",
    });
  });

  it("rend null sans URL de paiement ou sans identifiant", () => {
    expect(readHelloAssoCheckout({ success: 1, content: { id: 1 } })).toBeNull();
    expect(readHelloAssoCheckout({ success: 1, content: { redirectUrl: "https://x.test/pay" } })).toBeNull();
    expect(readHelloAssoCheckout({})).toBeNull();
  });
});
