import { describe, it, expect } from "vitest";
import {
  buildServiceSuggestions,
  matchesResourceSearch,
  normalizeSearchText,
  resolveServicePoints,
  resourceDisplayName,
  spreadServicePoints,
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

describe("spreadServicePoints", () => {
  const distM = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) =>
    Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180));

  it("un service seul garde sa position exacte", () => {
    expect(spreadServicePoints([{ id: "a", lng: 3.06, lat: 50.6 }]).get("a")).toEqual({ lng: 3.06, lat: 50.6 });
  });

  it("services d'un même lieu : tous à des positions distinctes, en cercle autour du lieu", () => {
    const lieu = { lng: 3.06, lat: 50.6 };
    const pts = Array.from({ length: 18 }, (_, i) => ({ id: `s${i}`, ...lieu }));
    const pos = spreadServicePoints(pts);
    const uniques = new Set([...pos.values()].map((p) => `${p.lng.toFixed(7)},${p.lat.toFixed(7)}`));
    expect(uniques.size).toBe(18);
    const rayons = [...pos.values()].map((p) => distM(p, lieu));
    expect(Math.max(...rayons) - Math.min(...rayons)).toBeLessThan(0.5); // même rayon
    expect(rayons[0]).toBeGreaterThanOrEqual(20);
    expect(rayons[0]).toBeLessThan(60); // reste au pied du lieu
  });

  it("deux lieux distincts ne se mélangent pas", () => {
    const pos = spreadServicePoints([
      { id: "a", lng: 3.06, lat: 50.6 },
      { id: "b", lng: 3.06, lat: 50.6 },
      { id: "c", lng: 2.3, lat: 48.8 },
    ]);
    expect(pos.get("c")).toEqual({ lng: 2.3, lat: 48.8 });
    expect(distM(pos.get("a")!, { lng: 3.06, lat: 50.6 })).toBeGreaterThanOrEqual(20);
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
      { id: "propre", ...A },
      { id: "soeur", ...A },
      { id: "lieu", ...L },
    ]);
  });
});
