import { describe, it, expect } from "vitest";
import type { AdminResourceSection } from "../schema";
import { resolveCreateModal, resolveEditModal, getPath, formatCell } from "./resourceHelpers";

/** Section resource minimale — cast : create/edit sont posés par les défauts zod à la validation. */
function section(over: Record<string, unknown> = {}): AdminResourceSection {
  return { type: "resource", entityType: "organizations", ...over } as AdminResourceSection;
}

describe("resolveCreateModal — choix costum/standard piloté par la config", () => {
  it("create:false → null (pas de création)", () => {
    expect(resolveCreateModal(section({ create: false }))).toBeNull();
  });

  it("create:\"standard\" → modale standard du type, même si un form costum existe", () => {
    const costumForms = { f1: { id: "equipements", entityType: "organizations" } };
    expect(resolveCreateModal(section({ create: "standard" }), costumForms)).toBe("add-organization");
  });

  it("create:\"standard\" sur un type sans modale standard → null", () => {
    expect(resolveCreateModal(section({ create: "standard", entityType: "answers" }))).toBeNull();
  });

  it("clé forcée explicite « add-xxx » → renvoyée telle quelle", () => {
    expect(resolveCreateModal(section({ create: "add-mon-form" }))).toBe("add-mon-form");
  });

  it("inherit sans costumForms → modale standard du type", () => {
    expect(resolveCreateModal(section({ entityType: "poi" }))).toBe("add-poi");
    expect(resolveCreateModal(section({ entityType: "events" }), null)).toBe("add-event");
    expect(resolveCreateModal(section({ entityType: "projects" }), {})).toBe("add-project");
  });

  it("inherit + form costum du type → « add-<id> » (le costum prime sur le standard)", () => {
    const costumForms = { doc1: { id: "equipements-sportifs", entityType: "poi" } };
    expect(resolveCreateModal(section({ entityType: "poi" }), costumForms)).toBe(
      "add-equipements-sportifs",
    );
  });

  it("inherit + costumForms d'un AUTRE type → retombe sur la modale standard", () => {
    const costumForms = { doc1: { id: "equipements", entityType: "poi" } };
    expect(resolveCreateModal(section({ entityType: "organizations" }), costumForms)).toBe(
      "add-organization",
    );
  });

  it("inherit + type inconnu sans costum → null", () => {
    expect(resolveCreateModal(section({ entityType: "citoyens" }))).toBeNull();
  });

  it("plusieurs forms du type : le costumSlug du site est prioritaire", () => {
    const costumForms = {
      a: { id: "form-a", entityType: "poi", costumSlug: "autreSite" },
      b: { id: "form-b", entityType: "poi", costumSlug: "monSite" },
    };
    expect(resolveCreateModal(section({ entityType: "poi" }), costumForms, "monSite")).toBe(
      "add-form-b",
    );
  });

  it("aucun form ne matche le siteSlug → premier doc du type", () => {
    const costumForms = {
      a: { id: "form-a", entityType: "poi", costumSlug: "autreSite" },
      b: { id: "form-b", entityType: "poi", costumSlug: "encoreUnAutre" },
    };
    expect(resolveCreateModal(section({ entityType: "poi" }), costumForms, "monSite")).toBe(
      "add-form-a",
    );
  });

  it("doc sans id → retombe sur la clé du record", () => {
    const costumForms = { maCle: { entityType: "poi" } };
    expect(resolveCreateModal(section({ entityType: "poi" }), costumForms)).toBe("add-maCle");
  });

  it("create absent (défaut) se comporte comme inherit", () => {
    // section() ne pose pas create → branche `?? "inherit"`.
    expect(resolveCreateModal(section({ entityType: "events" }))).toBe("add-event");
  });
});

describe("resolveEditModal — même contrat de choix que create", () => {
  it("edit:false → désactivé", () => {
    expect(resolveEditModal(section({ edit: false }))).toEqual({ enabled: false, modalName: null });
  });

  it("edit:\"inherit\" → activé, modalName null (résolution publique DynamicEditModal)", () => {
    expect(resolveEditModal(section({ edit: "inherit" }))).toEqual({ enabled: true, modalName: null });
  });

  it("edit absent (défaut) → inherit (résolution publique)", () => {
    expect(resolveEditModal(section())).toEqual({ enabled: true, modalName: null });
  });

  it("edit:\"standard\" → form générique edit-profile forcé", () => {
    expect(resolveEditModal(section({ edit: "standard" }))).toEqual({
      enabled: true,
      modalName: "edit-profile",
    });
  });

  it("clé forcée explicite « edit-xxx » → renvoyée telle quelle", () => {
    expect(resolveEditModal(section({ edit: "edit-equipements" }))).toEqual({
      enabled: true,
      modalName: "edit-equipements",
    });
  });
});

describe("getPath — lecture d'un chemin pointé", () => {
  const doc = { name: "Foo", address: { city: "Paris", geo: { lat: 48.85 } }, tags: ["a", "b"] };

  it("chemin simple", () => {
    expect(getPath(doc, "name")).toBe("Foo");
  });

  it("chemin imbriqué à 2 et 3 niveaux", () => {
    expect(getPath(doc, "address.city")).toBe("Paris");
    expect(getPath(doc, "address.geo.lat")).toBe(48.85);
  });

  it("segment absent → undefined (sans lever)", () => {
    expect(getPath(doc, "address.postalCode")).toBeUndefined();
    expect(getPath(doc, "missing.deep.path")).toBeUndefined();
  });

  it("objet null/undefined → undefined", () => {
    expect(getPath(null, "a.b")).toBeUndefined();
    expect(getPath(undefined, "a")).toBeUndefined();
  });

  it("traversée d'un scalaire → undefined (pas de propriétés de string)", () => {
    expect(getPath(doc, "name.length")).toBeUndefined();
  });

  it("index de tableau accessible comme clé", () => {
    expect(getPath(doc, "tags.1")).toBe("b");
  });
});

describe("formatCell — rendu texte d'une cellule", () => {
  it("string et number → tels quels", () => {
    expect(formatCell("Foo")).toBe("Foo");
    expect(formatCell(0)).toBe("0");
    expect(formatCell(42.5)).toBe("42.5");
  });

  it("null/undefined → tiret cadratin", () => {
    expect(formatCell(null)).toBe("—");
    expect(formatCell(undefined)).toBe("—");
  });

  it("booléen → coche ou tiret", () => {
    expect(formatCell(true)).toBe("✓");
    expect(formatCell(false)).toBe("—");
  });

  it("objet quelconque → chaîne vide (une colonne ne rend pas une structure)", () => {
    // Les TABLEAUX, eux, sont désormais rendus : ce sont des champs multivalués ordinaires,
    // et les laisser vides masquait des données bien présentes (cf. bloc « champs MULTIVALUÉS »).
    expect(formatCell({ a: 1 })).toBe("");
  });
});

describe("formatCell — champs MULTIVALUÉS", () => {
  // Sans ce cas, la colonne « Organisme » de la bibliothèque restait VIDE alors que 610 des 686
  // documents en portent un : la valeur est un tableau, qui tombait dans le repli `""`.
  it("joint les valeurs d'un tableau de chaînes", () => {
    expect(formatCell(["APMR", "IFREMER"])).toBe("APMR, IFREMER");
  });

  it("un seul élément s'affiche seul", () => {
    expect(formatCell(["APMR"])).toBe("APMR");
  });

  it("tableau vide ou sans contenu utile → tiret, comme une valeur absente", () => {
    expect(formatCell([])).toBe("—");
    expect(formatCell([null, undefined])).toBe("—");
  });

  it("ignore les éléments non rendus plutôt que de laisser des séparateurs vides", () => {
    expect(formatCell(["APMR", null, "IFREMER"])).toBe("APMR, IFREMER");
  });
});
