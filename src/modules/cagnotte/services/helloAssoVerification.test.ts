import { describe, expect, it } from "vitest";
import { readHelloAssoStatus } from "./helloAssoVerification";

describe("readHelloAssoStatus", () => {
  it("payé et enregistré par le serveur, avec la commande HelloAsso", () => {
    expect(readHelloAssoStatus({ success: 1, paid: true, recorded: true, orderId: 98765 })).toEqual({
      paid: true,
      recorded: true,
      inProgress: false,
      orderId: "98765",
    });
  });

  it("payé mais non enregistré : garde l'erreur du serveur", () => {
    expect(readHelloAssoStatus({ success: 1, paid: true, recorded: false, recordError: "depense not found" })).toEqual({
      paid: true,
      recorded: false,
      inProgress: false,
      recordError: "depense not found",
    });
  });

  it("en attente tant qu'aucune commande n'est jointe, ou pendant un règlement ailleurs", () => {
    expect(readHelloAssoStatus({ success: 1, paid: false, orderId: null })).toEqual({ paid: false, recorded: false, inProgress: false });
    expect(readHelloAssoStatus({ success: 1, paid: false, recorded: false, inProgress: true })).toMatchObject({ inProgress: true });
  });

  it("rend null pour une réponse incomplète, jamais « en attente »", () => {
    // Backend sans `helloassoStatus` : l'action inconnue renvoie `[]`.
    expect(readHelloAssoStatus({})).toBeNull();
    expect(readHelloAssoStatus({ success: 1, paid: "true" })).toBeNull();
    // Backend sans règlement serveur : `recorded` absent.
    expect(readHelloAssoStatus({ success: 1, paid: true, orderId: 1 })).toBeNull();
  });
});
