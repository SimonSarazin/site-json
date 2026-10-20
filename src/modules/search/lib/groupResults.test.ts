import { describe, it, expect } from "vitest";
import { grouperParChamp, comparerValeurs } from "./groupResults";

const fiche = (name: string, extra: Record<string, unknown>) => ({ id: name, serverData: { name, ...extra } });
const noms = (g: { items: { id: string }[] }) => g.items.map((i) => i.id);

describe("grouperParChamp", () => {
  it("regroupe par année, groupes du plus récent au plus ancien", () => {
    const r = [fiche("n°74", { annee: 2022 }), fiche("n°70", { annee: 2021 }), fiche("n°73", { annee: 2022 })];
    const g = grouperParChamp(r, "annee", "desc");
    expect(g.map((x) => x.cle)).toEqual(["2022", "2021"]);
    expect(noms(g[0])).toEqual(["n°74", "n°73"]);
  });

  it("garde l'ordre du serveur DANS un groupe", () => {
    const r = [fiche("b", { annee: 2022 }), fiche("a", { annee: 2022 })];
    expect(noms(grouperParChamp(r, "annee", "desc")[0])).toEqual(["b", "a"]);
  });

  it("compare en NOMBRE, qu'une valeur soit stockée en chaîne ou en nombre", () => {
    // Un tri de chaînes mettrait « 9 » après « 10 ».
    const r = [fiche("a", { n: "9" }), fiche("b", { n: 10 }), fiche("c", { n: "2" })];
    expect(grouperParChamp(r, "n", "asc").map((x) => x.cle)).toEqual(["2", "9", "10"]);
  });

  it("fusionne « 2022 » et 2022 dans le même groupe", () => {
    const r = [fiche("a", { annee: "2022" }), fiche("b", { annee: 2022 })];
    expect(grouperParChamp(r, "annee")).toHaveLength(1);
  });

  it("place les fiches SANS valeur dans un groupe final, sans les écarter", () => {
    const r = [fiche("sans", {}), fiche("n°74", { annee: 2022 }), fiche("vide", { annee: "  " })];
    const g = grouperParChamp(r, "annee", "desc");
    expect(g.map((x) => x.cle)).toEqual(["2022", null]);
    expect(noms(g[1])).toEqual(["sans", "vide"]);
  });

  it("lit un chemin pointé et range un tableau sous sa première valeur", () => {
    const r = [fiche("a", { address: { addressLocality: "Arras" } }), fiche("b", { tags: ["2021", "2022"] })];
    expect(grouperParChamp(r, "address.addressLocality")[0].cle).toBe("Arras");
    const parTag = grouperParChamp(r, "tags");
    expect(parTag.find((x) => x.cle === "2021")?.items).toHaveLength(1);
    expect(parTag.find((x) => x.cle === "2022")).toBeUndefined();
  });

  it("trie des libellés texte à la française", () => {
    const r = [fiche("a", { t: "Calaisis" }), fiche("b", { t: "Artois" }), fiche("c", { t: "Écrans" })];
    expect(grouperParChamp(r, "t", "asc").map((x) => x.cle)).toEqual(["Artois", "Calaisis", "Écrans"]);
  });

  it("rend une liste vide pour des résultats vides", () => {
    expect(grouperParChamp([], "annee")).toEqual([]);
  });
});

describe("grouperParChamp — tri dans les groupes", () => {
  const le = (jour: number) => new Date(Date.UTC(2026, 8, jour));

  it("trie les items de chaque groupe, du plus récemment créé au plus ancien", () => {
    // Cas réel : le backend ignore la 2e clé de `sortBy` et rend l'ordre d'insertion (n°20, 21, 22).
    const r = [
      fiche("n°20", { annee: "2007", created: le(1) }),
      fiche("n°21", { annee: "2007", created: le(2) }),
      fiche("n°28", { annee: "2009", created: le(3) }),
      fiche("n°22", { annee: "2007", created: le(4) }),
    ];
    const g = grouperParChamp(r, "annee", "desc", { champ: "created", ordre: "desc" });
    expect(g.map(noms)).toEqual([["n°28"], ["n°22", "n°21", "n°20"]]);
  });

  it("place les items sans valeur de tri en dernier, quel que soit l'ordre, sans perdre l'ordre du serveur", () => {
    const r = [fiche("sans1", { annee: 2007 }), fiche("b", { annee: 2007, rang: 2 }), fiche("sans2", { annee: 2007 }), fiche("a", { annee: 2007, rang: 1 })];
    expect(noms(grouperParChamp(r, "annee", "asc", { champ: "rang", ordre: "desc" })[0])).toEqual(["b", "a", "sans1", "sans2"]);
    expect(noms(grouperParChamp(r, "annee", "asc", { champ: "rang" })[0])).toEqual(["a", "b", "sans1", "sans2"]);
  });

  it("garde l'ordre du serveur à valeur égale (tri stable)", () => {
    const r = [fiche("x", { annee: 2007, rang: 1 }), fiche("y", { annee: 2007, rang: 1 })];
    expect(noms(grouperParChamp(r, "annee", "asc", { champ: "rang", ordre: "desc" })[0])).toEqual(["x", "y"]);
  });

  it("trie aussi le groupe des fiches sans valeur de regroupement", () => {
    const r = [fiche("a", { rang: 1 }), fiche("b", { rang: 2 })];
    expect(noms(grouperParChamp(r, "annee", "asc", { champ: "rang", ordre: "desc" })[0])).toEqual(["b", "a"]);
  });
});

describe("comparerValeurs", () => {
  it("compare nombres, chaînes numériques et dates par leur valeur", () => {
    expect(comparerValeurs("9", 10)).toBeLessThan(0);
    expect(comparerValeurs(new Date(2026, 0, 2), new Date(2026, 0, 1))).toBeGreaterThan(0);
    expect(comparerValeurs("Écrans", "Artois")).toBeGreaterThan(0);
  });

  it("rend null quand une valeur manque, est vide ou n'est pas comparable", () => {
    expect(comparerValeurs(undefined, 1)).toBeNull();
    expect(comparerValeurs(" ", "a")).toBeNull();
    expect(comparerValeurs(new Date("x"), new Date())).toBeNull();
    expect(comparerValeurs({ sec: 1 }, 2)).toBeNull();
  });
});
