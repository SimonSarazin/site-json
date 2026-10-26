import { describe, it, expect } from "vitest";
import { enfantsDeSection, findSectionByRef, findSectionsOfTypes, walkSections, type SectionLike } from "./sectionContainers";

/**
 * Le registre des containers est le point de rendez-vous du prefetch SSR et des gardes : une
 * section imbriquée qu'il ne sait pas atteindre est ratée SILENCIEUSEMENT — ni préchargée, ni vue
 * par les préflights. Ces tests verrouillent chaque forme d'imbrication reconnue.
 */
const recherche = new Set(["searchPro", "searchProStatic"]);

const sec = (type: string, props?: Record<string, unknown>): SectionLike => ({ type, props });

describe("enfantsDeSection", () => {
  it("descend dans les deux colonnes d'un gridLayout", () => {
    const enfants = enfantsDeSection(
      sec("gridLayout", { leftSection: sec("searchPro"), rightSection: sec("cards") }),
    );
    expect(enfants.map((e) => e.type)).toEqual(["searchPro", "cards"]);
  });

  it("descend dans le mode RANGÉE `sections`", () => {
    const enfants = enfantsDeSection(
      sec("gridLayout", { sections: [sec("agenda"), sec("member"), sec("cards")] }),
    );
    expect(enfants.map((e) => e.type)).toEqual(["agenda", "member", "cards"]);
  });

  it("combine colonnes et rangée sans en perdre", () => {
    const enfants = enfantsDeSection(
      sec("gridLayout", { leftSection: sec("a"), sections: [sec("b")] }),
    );
    expect(enfants.map((e) => e.type)).toEqual(["a", "b"]);
  });

  it("descend dans le contenu de chaque onglet", () => {
    const enfants = enfantsDeSection(
      sec("tabs", { tabs: [{ content: [sec("x")] }, { content: [sec("y"), sec("z")] }] }),
    );
    expect(enfants.map((e) => e.type)).toEqual(["x", "y", "z"]);
  });

  it("rend [] pour une section qui n'est pas un container, ou sans props", () => {
    expect(enfantsDeSection(sec("cards", { items: [] }))).toEqual([]);
    expect(enfantsDeSection({ type: "gridLayout" })).toEqual([]);
  });

  it("ignore une valeur de mauvaise forme plutôt que de planter", () => {
    expect(enfantsDeSection(sec("gridLayout", { sections: "pas un tableau" }))).toEqual([]);
    expect(enfantsDeSection(sec("tabs", { tabs: [{ content: null }] }))).toEqual([]);
  });
});

describe("findSectionsOfTypes", () => {
  it("trouve une section de recherche imbriquée dans une RANGÉE", () => {
    const pages = [sec("gridLayout", { sections: [sec("agenda"), sec("searchProStatic")] })];
    expect(findSectionsOfTypes(pages, recherche).map((s) => s.type)).toEqual(["searchProStatic"]);
  });

  it("traverse plusieurs niveaux de containers", () => {
    const pages = [
      sec("tabs", {
        tabs: [{ content: [sec("gridLayout", { sections: [sec("searchPro")] })] }],
      }),
    ];
    expect(findSectionsOfTypes(pages, recherche)).toHaveLength(1);
  });

  it("ne descend PAS dans un container qui est lui-même du type cherché", () => {
    // Un container ne peut pas être une section de recherche : s'il l'était, on le retiendrait
    // lui plutôt que d'aller chercher ses filles.
    const pages = [sec("gridLayout", { sections: [sec("searchPro")] })];
    const trouve = findSectionsOfTypes(pages, new Set(["gridLayout"]));
    expect(trouve.map((s) => s.type)).toEqual(["gridLayout"]);
  });

  it("rend [] quand rien ne correspond", () => {
    expect(findSectionsOfTypes([sec("cards"), sec("html")], recherche)).toEqual([]);
  });
});

describe("walkSections", () => {
  it("émet TOUTE la surface, container AVANT ses filles", () => {
    const pages = [sec("html"), sec("gridLayout", { sections: [sec("agenda"), sec("member")] })];
    expect(walkSections(pages).map((s) => s.type)).toEqual([
      "html",
      "gridLayout",
      "agenda",
      "member",
    ]);
  });
});

describe("findSectionByRef", () => {
  const pages = [
    { path: "/", sections: [{ type: "agenda", id: "section-events", props: { a: 1 } }] },
    { path: "/lieux", sections: [{ type: "gridLayout", props: { rightSection: { type: "searchProStatic", id: "section-events", props: { b: 2 } } } }] },
  ];
  it("trouve la section par page ET id, même dans un container", () => {
    expect(findSectionByRef(pages, { page: "/lieux", sectionId: "section-events" })?.props).toEqual({ b: 2 });
    expect(findSectionByRef(pages, { page: "/", sectionId: "section-events" })?.props).toEqual({ a: 1 });
  });
  it("null si la page ou l'id n'existent pas", () => {
    expect(findSectionByRef(pages, { page: "/x", sectionId: "section-events" })).toBeNull();
    expect(findSectionByRef(pages, { page: "/", sectionId: "nope" })).toBeNull();
    expect(findSectionByRef(undefined, { page: "/", sectionId: "a" })).toBeNull();
  });
});
