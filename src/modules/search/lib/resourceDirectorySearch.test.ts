import { describe, it, expect } from "vitest";
import {
  buildServiceSuggestions,
  matchesResourceSearch,
  normalizeSearchText,
  resolveServicePoints,
  resourceDisplayName,
  groupServicesByPlace,
} from "./resourceDirectorySearch";

describe("resourceDisplayName", () => {
  const t = (k: string, _f?: string, p?: Record<string, unknown>) => (p ? `${k}:${JSON.stringify(p)}` : k);
  it("nom saisi, sinon repli traduit, sinon lieu porteur, sinon lieu inconnu", () => {
    expect(resourceDisplayName({ name: "Salle A" }, t, "Lieu")).toBe("Salle A");
    expect(resourceDisplayName({ nameFallback: { key: "rd.n", params: { count: 2 } } }, t, "Lieu")).toBe('rd.n:{"count":2}');
    expect(resourceDisplayName({}, t, "Lieu")).toBe("Lieu");
    expect(resourceDisplayName({}, t)).toBe("resourceDirectory.unknownPlace");
  });
});

describe("normalizeSearchText", () => {
  it("sans accents, en minuscules, espaces réduits", () => {
    expect(normalizeSearchText("  Saint-Étienne   DU Rouvray ")).toBe("saint-etienne du rouvray");
  });
});

describe("matchesResourceSearch", () => {
  const textes = ["Salle Majorelle", "La Coroutine", "Lille", "59000"];

  it("recherche vide : tout passe", () => {
    expect(matchesResourceSearch(textes, "  ")).toBe(true);
  });
  it("trouve par lieu porteur, ville ou code postal, sans tenir compte des accents", () => {
    expect(matchesResourceSearch(textes, "coroutine")).toBe(true);
    expect(matchesResourceSearch(textes, "LILLE")).toBe(true);
    expect(matchesResourceSearch(textes, "59000")).toBe(true);
    expect(matchesResourceSearch(["Salle", "Évry"], "evry")).toBe(true);
  });
  it("tous les mots doivent se trouver, dans n'importe quel champ", () => {
    expect(matchesResourceSearch(textes, "majorelle lille")).toBe(true);
    expect(matchesResourceSearch(textes, "majorelle paris")).toBe(false);
  });
  it("ignore les textes absents", () => {
    expect(matchesResourceSearch([undefined, null, "Lille"], "lille")).toBe(true);
  });
});

describe("groupServicesByPlace", () => {
  it("un repère par lieu porteur, dans l'ordre d'arrivée", () => {
    expect(
      groupServicesByPlace([
        { id: "a", parentId: "p1", lng: 3.06, lat: 50.6 },
        { id: "c", parentId: "p2", lng: 2.3, lat: 48.8 },
        { id: "b", parentId: "p1", lng: 3.06, lat: 50.6 },
      ]),
    ).toEqual([
      { parentId: "p1", lng: 3.06, lat: 50.6, ids: ["a", "b"] },
      { parentId: "p2", lng: 2.3, lat: 48.8, ids: ["c"] },
    ]);
  });
  it("deux lieux au même point : deux repères", () => {
    expect(
      groupServicesByPlace([
        { id: "a", parentId: "p1", lng: 3, lat: 50 },
        { id: "b", parentId: "p2", lng: 3, lat: 50 },
      ]).map((g) => g.ids),
    ).toEqual([["a"], ["b"]]);
  });
  it("un lieu dont les services ont des positions différentes : un seul repère, à la position du lieu", () => {
    expect(
      groupServicesByPlace(
        [
          { id: "a", parentId: "p1", lng: 3.1, lat: 50.1 },
          { id: "b", parentId: "p1", lng: 3, lat: 50 },
        ],
        (id) => (id === "p1" ? { lng: 3, lat: 50 } : null),
      ),
    ).toEqual([{ parentId: "p1", lng: 3, lat: 50, ids: ["a", "b"] }]);
  });
  it("lieu sans position connue : celle de son premier service ; service sans lieu : par point", () => {
    expect(
      groupServicesByPlace([
        { id: "a", parentId: "p1", lng: 3.1, lat: 50.1 },
        { id: "b", parentId: "p1", lng: 3, lat: 50 },
        { id: "x", lng: 2, lat: 48 },
        { id: "y", lng: 2, lat: 48 },
      ]),
    ).toEqual([
      { parentId: "p1", lng: 3.1, lat: 50.1, ids: ["a", "b"] },
      { lng: 2, lat: 48, ids: ["x", "y"] },
    ]);
  });
  it("aucun service : aucun repère", () => {
    expect(groupServicesByPlace([])).toEqual([]);
  });
});

describe("buildServiceSuggestions", () => {
  const ressources = [
    { id: "a", name: "Espace de coworking", parentName: "La Coroutine", locality: "Lille", postalCode: "59000" },
    { id: "b", name: "Salle Majorelle", parentName: "La Coroutine", locality: "Lille", postalCode: "59000" },
    { id: "c", name: "Gîte", parentName: "Le Moulin", locality: "Arras", postalCode: "62000" },
  ];

  it("moins de 2 caractères : rien", () => {
    expect(buildServiceSuggestions(ressources, "l")).toEqual([]);
  });
  it("cherche sur le service, le lieu, la ville, le code postal ; sous-titre = lieu · ville", () => {
    expect(buildServiceSuggestions(ressources, "coroutine").map((s) => s.id)).toEqual(["a", "b"]);
    expect(buildServiceSuggestions(ressources, "majorelle")).toEqual([
      { id: "b", title: "Salle Majorelle", subtitle: "La Coroutine · Lille" },
    ]);
    expect(buildServiceSuggestions(ressources, "62000").map((s) => s.id)).toEqual(["c"]);
  });
  it("plafonné à `limit`", () => {
    expect(buildServiceSuggestions(ressources, "e", 2)).toEqual([]);
    expect(buildServiceSuggestions(ressources, "la", 1)).toHaveLength(1);
  });
});

describe("resolveServicePoints", () => {
  const A = { lng: 3, lat: 50 };
  const L = { lng: 2, lat: 48 };
  it("position propre, sinon du lieu porteur, sinon d'un service du même lieu ; sinon non placé", () => {
    expect(
      resolveServicePoints([
        { id: "propre", parentId: "p1", own: A, parent: null },
        { id: "soeur", parentId: "p1", own: null, parent: null },
        { id: "lieu", parentId: "p2", own: null, parent: L },
        { id: "perdu", parentId: "p3", own: null, parent: null },
      ]),
    ).toEqual([
      { id: "propre", parentId: "p1", ...A },
      { id: "soeur", parentId: "p1", ...A },
      { id: "lieu", parentId: "p2", ...L },
    ]);
  });
});
