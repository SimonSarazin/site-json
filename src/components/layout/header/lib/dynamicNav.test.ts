import { describe, it, expect } from "vitest";
import { resolveDynamicNavValues, buildDynamicNavChildren, DEFAULT_DYNAMIC_NAV_LIMIT } from "./dynamicNav";

describe("resolveDynamicNavValues", () => {
  it("liste statique (tableau) : renvoie les valeurs telles quelles", () => {
    expect(resolveDynamicNavValues(["La petite enfance", "La santé"], undefined)).toEqual([
      "La petite enfance",
      "La santé",
    ]);
  });

  it("liste statique (map valeur→libellé) : renvoie les clés", () => {
    expect(resolveDynamicNavValues({ Pêche: "Pêche" }, undefined)).toEqual(["Pêche"]);
  });

  it("liste dynamique (recette collection/distinct) : ignore la déclaration, renvoie les valeurs résolues serveur", () => {
    const declared = { collection: "poi", where: { "source.keys": "parent62" }, distinct: "themes" };
    expect(resolveDynamicNavValues(declared, ["Sport", "Culture"])).toEqual(["Sport", "Culture"]);
  });

  it("liste dynamique pas encore résolue (dynamicValues undefined) : liste vide, pas de crash", () => {
    const declared = { collection: "poi", distinct: "themes" };
    expect(resolveDynamicNavValues(declared, undefined)).toEqual([]);
  });

  it("déclaration absente : liste vide", () => {
    expect(resolveDynamicNavValues(undefined, undefined)).toEqual([]);
  });

  it("map d'entités (clés ObjectId) : rejetée comme côté serveur, liste vide", () => {
    const map = { "507f1f77bcf86cd799439011": "Un lieu" };
    expect(resolveDynamicNavValues(map, undefined)).toEqual([]);
  });
});

/** Reproduit exactement la lecture côté `SearchHeaderSection.tsx` (`raw.split(",")` puis
 *  `decodeURIComponent` par segment) — sert à prouver l'aller-retour URL, pas seulement la forme
 *  de la chaîne produite. */
function readBackAsSearchHeaderSectionWould(path: string, filterId: string): string[] {
  const raw = new URLSearchParams(path.split("?")[1]).get(filterId) ?? "";
  if (!raw) return [];
  return raw.split(",").map((s) => {
    try {
      return decodeURIComponent(s.trim());
    } catch {
      return s.trim();
    }
  });
}

describe("buildDynamicNavChildren", () => {
  const owner = { pathname: "/blog", filter: { id: "theme" } };

  it("un enfant par valeur, path = page propriétaire + query param filtre=valeur (double-encodé)", () => {
    const children = buildDynamicNavChildren(owner, ["La petite enfance", "La santé"]);
    expect(children).toEqual([
      { label: { fr: "La petite enfance", en: "La petite enfance" }, path: "/blog?theme=La%2520petite%2520enfance" },
      { label: { fr: "La santé", en: "La santé" }, path: "/blog?theme=La%2520sant%25C3%25A9" },
    ]);
  });

  it("aller-retour correct pour une valeur banale", () => {
    const [child] = buildDynamicNavChildren(owner, ["La petite enfance"]);
    expect(readBackAsSearchHeaderSectionWould(child.path!, "theme")).toEqual(["La petite enfance"]);
  });

  it("aller-retour correct pour une valeur contenant une virgule LITTÉRALE (cas réel en base, cf. dropdownFilterToParam) — sans le double encodage, `raw.split(\",\")` la coupait en deux", () => {
    const [child] = buildDynamicNavChildren(owner, ["Salon professionnel,"]);
    expect(readBackAsSearchHeaderSectionWould(child.path!, "theme")).toEqual(["Salon professionnel,"]);
  });

  it("respecte le plafond passé explicitement", () => {
    const children = buildDynamicNavChildren(owner, ["a", "b", "c"], 2);
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.label.fr)).toEqual(["A", "B"]);
  });

  it("plafond par défaut (DEFAULT_DYNAMIC_NAV_LIMIT) si non précisé", () => {
    const values = Array.from({ length: DEFAULT_DYNAMIC_NAV_LIMIT + 5 }, (_, i) => `valeur-${i}`);
    const children = buildDynamicNavChildren(owner, values);
    expect(children).toHaveLength(DEFAULT_DYNAMIC_NAV_LIMIT);
  });

  it("liste vide : aucun enfant", () => {
    expect(buildDynamicNavChildren(owner, [])).toEqual([]);
  });
});
