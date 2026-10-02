import { describe, expect, it } from "vitest";
import { readHelloAssoStatus } from "./helloAssoVerification";

describe("readHelloAssoStatus", () => {
  it("payé quand le serveur l'annonce, avec la commande HelloAsso", () => {
    expect(readHelloAssoStatus({ success: 1, paid: true, orderId: 98765 })).toEqual({ paid: true, orderId: "98765" });
  });

  it("en attente tant qu'aucune commande n'est jointe", () => {
    expect(readHelloAssoStatus({ success: 1, paid: false, orderId: null })).toEqual({ paid: false });
  });

  it("ne tient pour payé que le booléen `true`", () => {
    expect(readHelloAssoStatus({ success: 1, paid: "true" })).toEqual({ paid: false });
  });
});
