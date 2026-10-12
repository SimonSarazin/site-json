import { describe, it, expect } from "vitest";
import { organisationSdk } from "../__fixtures__/organisationSdk";
import { createdToFinderElement, finderAddNewDeclaration, resolveFinderAddNewModal } from "./finderAddNew";

/**
 * Le bouton « Ajouter » d'un finder : QUELLE modale il ouvre (ce que le site déclare, sinon la modale
 * standard du type — jamais un formulaire costum pris d'office), et sous quelle forme l'élément créé
 * entre dans la question.
 */

const cae = { id: "cae", entityType: "organizations", costumSlug: "federationDesCae" };
const structure = { id: "structure", entityType: "organizations", costumSlug: "federationDesCae" };
const costumForms = { cae, structure };
const mapping = { finderaapStep1abc: "add-cae", organizations: "add-structure" };

describe("finderAddNewDeclaration", () => {
  it("la question d'abord, puis le type cherché", () => {
    expect(finderAddNewDeclaration(mapping, "finderaapStep1abc", "organizations")).toEqual({ key: "finderaapStep1abc", value: "add-cae" });
    expect(finderAddNewDeclaration(mapping, "finderAutreQuestion", "organizations")).toEqual({ key: "organizations", value: "add-structure" });
    expect(finderAddNewDeclaration(mapping, undefined, "organizations")).toEqual({ key: "organizations", value: "add-structure" });
  });

  it("rien de déclaré pour ce finder : null", () => {
    expect(finderAddNewDeclaration(undefined, "finderX", "organizations")).toBeNull();
    expect(finderAddNewDeclaration({ finderAilleurs: "add-cae", projects: "add-cae" }, "finderX", "organizations")).toBeNull();
  });

  it("une valeur vide, absente ou héritée de l'objet n'est pas une déclaration", () => {
    expect(finderAddNewDeclaration({ finderX: "", organizations: null }, "finderX", "organizations")).toBeNull();
    expect(finderAddNewDeclaration({ finderX: "" , organizations: "add-structure" }, "finderX", "organizations"))
      .toEqual({ key: "organizations", value: "add-structure" });
    expect(finderAddNewDeclaration({}, "constructor", "toString")).toBeNull();
  });

  it("une valeur mal formée RESTE une déclaration : au resolveur de la refuser, pas de l'ignorer", () => {
    expect(finderAddNewDeclaration({ finderX: ["add-cae"], organizations: "add-structure" }, "finderX", "organizations"))
      .toEqual({ key: "finderX", value: ["add-cae"] });
  });
});

describe("resolveFinderAddNewModal", () => {
  it("la question d'abord : deux finders d'un même type peuvent vouloir deux formulaires", () => {
    expect(resolveFinderAddNewModal(mapping, "finderaapStep1abc", "organizations", costumForms)).toBe("add-cae");
  });

  it("puis le type cherché", () => {
    expect(resolveFinderAddNewModal(mapping, "finderAutreQuestion", "organizations", costumForms)).toBe("add-structure");
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

  it("un type qui n'est qu'une propriété héritée de l'objet n'a pas de modale", () => {
    expect(resolveFinderAddNewModal({}, "finderX", "constructor")).toBeNull();
  });

  it("une valeur vide ou héritée de l'objet ne compte pas pour une déclaration", () => {
    expect(resolveFinderAddNewModal({ finderX: "" }, "finderX", "organizations")).toBe("add-organization");
    expect(resolveFinderAddNewModal({}, "constructor", "organizations")).toBe("add-organization");
  });

  describe("un formulaire costum ne s'ouvre QUE déclaré", () => {
    it("sans déclaration, le formulaire costum du site n'est pas pris d'office — même unique pour le type", () => {
      // Il estampille ce qu'il crée : une organisation « partenaire » naîtrait CAE, et entrerait dans l'annuaire.
      expect(resolveFinderAddNewModal(undefined, "finderX", "organizations", { cae })).toBe("add-organization");
      expect(resolveFinderAddNewModal({}, "finderX", "organizations", { cae })).toBe("add-organization");
    });

    it("une déclaration pour une AUTRE question ou un AUTRE type ne vaut pas pour ce finder", () => {
      expect(resolveFinderAddNewModal({ finderAilleurs: "add-cae", projects: "add-cae" }, "finderX", "organizations", { cae }))
        .toBe("add-organization");
    });

    it("le site peut demander la modale standard, sans formulaire costum à déclarer", () => {
      expect(resolveFinderAddNewModal({ organizations: "add-organization" }, "finderX", "organizations")).toBe("add-organization");
      // … y compris celle d'un autre type que celui cherché.
      expect(resolveFinderAddNewModal({ finderX: "add-project" }, "finderX", "organizations", { cae })).toBe("add-project");
    });
  });

  describe("une déclaration qui ne désigne aucune modale ouvrable : pas de bouton", () => {
    const MORTES: ReadonlyArray<readonly [string, unknown]> = [
      ["une faute de frappe sur l'identifiant du formulaire", "add-ca"],
      ["une modale d'édition", "edit-cae"],
      ["un nom sans le préfixe d'ajout", "cae"],
      ["le préfixe seul", "add-"],
      ["un préfixe d'ajout qui n'ouvre pas le nom", "x-add-cae"],
      ["une liste, là où il faut un nom", ["add-cae"]],
      ["un objet", { modal: "add-cae" }],
    ];

    it.each(MORTES)("%s → null, au lieu d'un bouton dont le clic n'ouvre rien", (_cas, valeur) => {
      expect(resolveFinderAddNewModal({ finderX: valeur }, "finderX", "organizations", costumForms)).toBeNull();
      expect(resolveFinderAddNewModal({ organizations: valeur }, "finderY", "organizations", costumForms)).toBeNull();
    });

    it("un formulaire costum que le site ne déclare pas (ou plus) → null", () => {
      expect(resolveFinderAddNewModal({ finderX: "add-cae" }, "finderX", "organizations", { structure })).toBeNull();
      expect(resolveFinderAddNewModal({ finderX: "add-cae" }, "finderX", "organizations")).toBeNull();
    });

    it("ne retombe NI sur le type NI sur le standard : le site a demandé un formulaire précis", () => {
      // La question est mal déclarée, le type bien : ouvrir `add-structure` créerait sans l'estampille voulue.
      expect(resolveFinderAddNewModal({ finderX: "add-inconnu", organizations: "add-structure" }, "finderX", "organizations", costumForms))
        .toBeNull();
      expect(resolveFinderAddNewModal({ finderX: ["add-cae"], organizations: "add-structure" }, "finderX", "organizations", costumForms))
        .toBeNull();
    });

    it("le formulaire se reconnaît à son `id`, jamais à sa clé dans `costumForms` — le registre ne connaît que l'`id`", () => {
      const renomme = { id: "cae", entityType: "organizations" };
      expect(resolveFinderAddNewModal({ finderX: "add-cae" }, "finderX", "organizations", { ancienneCle: renomme })).toBe("add-cae");
      expect(resolveFinderAddNewModal({ finderX: "add-ancienneCle" }, "finderX", "organizations", { ancienneCle: renomme })).toBeNull();
      // Un document sans `id` n'est rangé sous aucun nom : `add-<sa clé>` n'ouvrirait rien.
      expect(resolveFinderAddNewModal({ finderX: "add-reseau" }, "finderX", "organizations", { reseau: { entityType: "organizations" } }))
        .toBeNull();
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
