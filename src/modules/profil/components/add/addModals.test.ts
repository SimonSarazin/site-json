import { describe, it, expect } from "vitest";
import { costumCreateKey, siteCostumAddModal } from "./addModals";

// Forme réelle (config ESS974, 26/10/2026) : un seul formulaire d'organisations, déclaré au slug du site.
const association = { id: "ess974-association", entityType: "organizations", costumSlug: "ESS974" };

describe("siteCostumAddModal — formulaire costum de l'« Ajouter » d'un profil", () => {
  it("un seul formulaire du site pour la collection → sa modale remplace le standard", () => {
    expect(siteCostumAddModal("organizations", { association }, "ESS974")).toBe("add-ess974-association");
  });

  it("`profileAdd: false` → aucun candidat : le profil garde le formulaire standard", () => {
    expect(siteCostumAddModal("organizations", { association: { ...association, profileAdd: false } }, "ESS974")).toBeNull();
  });

  it("un formulaire `profileAdd: false` ne compte pas dans une ambiguïté : l'autre est retenu", () => {
    const acteur = { id: "acteur", entityType: "organizations", costumSlug: "ESS974" };
    const forms = { association: { ...association, profileAdd: false }, acteur };
    expect(siteCostumAddModal("organizations", forms, "ESS974")).toBe("add-acteur");
  });

  it("plusieurs candidats → `null` : on ne choisit pas à la place du site", () => {
    const acteur = { id: "acteur", entityType: "organizations", costumSlug: "ESS974" };
    expect(siteCostumAddModal("organizations", { association, acteur }, "ESS974")).toBeNull();
  });
});

describe("costumCreateKey — type d'ajout d'un profil → collection", () => {
  it("« organization » interroge les formulaires d'`organizations`", () => {
    expect(costumCreateKey("organization", { association }, "ESS974")).toBe("add-ess974-association");
    expect(costumCreateKey("project", { association }, "ESS974")).toBeNull();
  });
});
