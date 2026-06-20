import { describe, it, expect } from "vitest";
import { buildAddressFromForm } from "./mutationUtils";

/**
 * `buildAddressFromForm` n'émet une address QUE si un `localityId` (id de ville réel, hex24,
 * sélectionné via l'autocomplete SIG) est présent. Sans lui, le backend (addressValid, validation
 * atomique de element/save) rejetterait toute la sauvegarde → on omet l'address.
 */
describe("buildAddressFromForm", () => {
  it("retourne undefined si aucun champ d'adresse n'est rempli", () => {
    expect(buildAddressFromForm({})).toBeUndefined();
    expect(buildAddressFromForm({ localityId: "54c09653f6b95c141800849e" })).toBeUndefined();
  });

  it("OMET l'address si localityId vide, même avec pays/ville/CP/rue remplis", () => {
    expect(
      buildAddressFromForm({
        addressCountry: "FR",
        addressLocality: "Lyon",
        postalCode: "69001",
        streetAddress: "1 place Bellecour",
        localityId: "", // ville non sélectionnée
      })
    ).toBeUndefined();
  });

  it("construit l'address quand un localityId réel est présent", () => {
    const addr = buildAddressFromForm({
      addressCountry: "FR",
      addressLocality: "LYON",
      postalCode: "69001",
      streetAddress: "1 place Bellecour",
      codeInsee: "69123",
      localityId: "54c09653f6b95c141800849e",
      level1: "58bd5d6494ef471f218b4588",
      level1Name: "France",
    });
    expect(addr).toMatchObject({
      "@type": "PostalAddress",
      addressCountry: "FR",
      addressLocality: "LYON",
      localityId: "54c09653f6b95c141800849e",
      codeInsee: "69123",
      postalCode: "69001",
      streetAddress: "1 place Bellecour",
      level1: "58bd5d6494ef471f218b4588",
      level1Name: "France",
    });
  });
});
