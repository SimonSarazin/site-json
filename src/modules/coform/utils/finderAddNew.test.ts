import { describe, it, expect } from "vitest";
import { organisationSdk } from "../__fixtures__/organisationSdk";
import { createdToFinderElement, resolveFinderAddNewModal } from "./finderAddNew";

/**
 * Le bouton « Ajouter » d'un finder : QUELLE modale il ouvre (config du site, puis formulaire costum du
 * site, puis standard), et sous quelle forme l'élément créé entre dans la question.
 */

describe("resolveFinderAddNewModal", () => {
  const mapping = { finderaapStep1abc: "add-cae", organizations: "add-structure" };

  it("la question d'abord : deux finders d'un même type peuvent vouloir deux formulaires", () => {
    expect(resolveFinderAddNewModal(mapping, "finderaapStep1abc", "organizations")).toBe("add-cae");
  });

  it("puis le type cherché", () => {
    expect(resolveFinderAddNewModal(mapping, "finderAutreQuestion", "organizations")).toBe("add-structure");
  });

  it("à défaut, la modale standard du type", () => {
    expect(resolveFinderAddNewModal(undefined, "finderX", "organizations")).toBe("add-organization");
    expect(resolveFinderAddNewModal({}, "finderX", "projects")).toBe("add-project");
    expect(resolveFinderAddNewModal({}, "finderX", "events")).toBe("add-event");
    expect(resolveFinderAddNewModal({}, "finderX", "poi")).toBe("add-poi");
  });

  it("une personne ne se crée pas depuis un formulaire : pas de modale", () => {
    expect(resolveFinderAddNewModal({}, "finderX", "citoyens")).toBeNull();
  });

  it("une valeur vide ou héritée de l'objet ne compte pas", () => {
    expect(resolveFinderAddNewModal({ finderX: "" }, "finderX", "organizations")).toBe("add-organization");
    expect(resolveFinderAddNewModal({}, "constructor", "organizations")).toBe("add-organization");
  });

  describe("sans déclaration : le formulaire costum du site pour le type — la règle de l'« Ajouter » d'un profil", () => {
    const cae = { id: "cae", entityType: "organizations", costumSlug: "federationDesCae" };

    it("un seul formulaire pour le type : c'est lui, pas le standard", () => {
      expect(resolveFinderAddNewModal(undefined, "finderX", "organizations", { costumForms: { cae }, siteSlug: "federationDesCae" }))
        .toBe("add-cae");
    });

    it("celui du costum du site passe devant un formulaire importé d'un autre costum", () => {
      const importe = { id: "tiers-lieux", entityType: "organizations", costumSlug: "navigatorDesTierslieux" };
      expect(resolveFinderAddNewModal(undefined, "finderX", "organizations", { costumForms: { importe, cae }, siteSlug: "federationDesCae" }))
        .toBe("add-cae");
    });

    it("deux formulaires du site pour le même type : on ne choisit pas — modale standard", () => {
      const autre = { id: "reseau", entityType: "organizations", costumSlug: "federationDesCae" };
      expect(resolveFinderAddNewModal(undefined, "finderX", "organizations", { costumForms: { cae, autre }, siteSlug: "federationDesCae" }))
        .toBe("add-organization");
    });

    it("la déclaration du site reste prioritaire", () => {
      expect(resolveFinderAddNewModal({ organizations: "add-structure" }, "finderX", "organizations", { costumForms: { cae }, siteSlug: "federationDesCae" }))
        .toBe("add-structure");
    });
  });
});

describe("createdToFinderElement", () => {
  it("le type est la COLLECTION de l'entité, pas sa nature (`type` d'une organisation)", async () => {
    // Sans `collection` dans les données : le cas où `type` (sa nature) tromperait.
    const entity = await organisationSdk({
      id: "6a0000000000000000000001",
      name: "Nouvelle CAE",
      type: "Cooperative",
      profilThumbImageUrl: "/upload/communecter/organizations/6a00/thumb/logo.png",
    });

    expect(createdToFinderElement(entity)).toEqual({
      id: "6a0000000000000000000001",
      name: "Nouvelle CAE",
      type: "organizations",
      // Vignette relue ABSOLUE par le SDK : la modale du finder la rend relative au moment de ranger.
      img: expect.stringContaining("/upload/communecter/organizations/6a00/thumb/logo.png"),
    });
  });
});
