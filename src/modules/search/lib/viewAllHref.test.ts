import { describe, it, expect } from "vitest";
import { buildViewAllHref } from "./viewAllHref";

describe("buildViewAllHref (lien « voir tous » d'un customHeader)", () => {
  it("sans filtre actif ni query de config : le chemin nu", () => {
    expect(buildViewAllHref("/ressources", new URLSearchParams())).toBe("/ressources");
  });

  it("query de config seule (scope de la page cible) : conservée telle quelle", () => {
    expect(buildViewAllHref("/ressources?territoire=Arrageois", new URLSearchParams())).toBe(
      "/ressources?territoire=Arrageois",
    );
  });

  it("REGRESSION — filtre actif + query de config : un seul `?`, le scope survit", () => {
    const href = buildViewAllHref(
      "/ressources?territoire=Arrageois",
      new URLSearchParams({ theme: "La santé" }),
    );
    // Avant le correctif : "/ressources?territoire=Arrageois?theme=La+sant%C3%A9" — le scope
    // devenait la valeur d'un paramètre fantôme et la page cible n'était plus filtrée.
    expect(href.split("?").length - 1).toBe(1);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("territoire")).toBe("Arrageois");
    expect(params.get("theme")).toBe("La santé");
  });

  it("clé présente des deux côtés : la config gagne (périmètre de la page cible)", () => {
    const href = buildViewAllHref(
      "/ressources?territoire=Arrageois",
      new URLSearchParams({ territoire: "Calaisis" }),
    );
    expect(new URLSearchParams(href.split("?")[1]).get("territoire")).toBe("Arrageois");
  });

  it("recherche texte reportée en `search`", () => {
    const href = buildViewAllHref("/lieux", new URLSearchParams(), "jeux");
    expect(new URLSearchParams(href.split("?")[1]).get("search")).toBe("jeux");
  });

  it("recherche vide : aucun paramètre `search` posé", () => {
    expect(buildViewAllHref("/lieux", new URLSearchParams(), "")).toBe("/lieux");
  });
});
