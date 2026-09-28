import { describe, it, expect } from "vitest";
import { solidTileStyle, tileSizeClasses, tilesContainerWidth } from "./actionTileStyle";

describe("solidTileStyle", () => {
  it("sans fond plein : aucun style, la tuile garde sa teinte de thème", () => {
    expect(solidTileStyle()).toBeUndefined();
    expect(solidTileStyle("  ", "#000")).toBeUndefined();
  });

  it("fond plein : fond et bordure de la même couleur, texte à la couleur fournie", () => {
    expect(solidTileStyle("var(--p62-vert)", "var(--p62-vert-encre)")).toEqual({
      backgroundColor: "var(--p62-vert)",
      borderColor: "var(--p62-vert)",
      color: "var(--p62-vert-encre)",
    });
  });

  it("fond plein sans couleur de texte : le texte n'est pas forcé", () => {
    expect(solidTileStyle("#1eae98")).toEqual({ backgroundColor: "#1eae98", borderColor: "#1eae98" });
  });
});

describe("tileSizeClasses", () => {
  it("sans taille : les classes historiques, à l'identique — les autres sites du parc en dépendent", () => {
    expect(tileSizeClasses()).toEqual({ title: "font-semibold", subtitle: "text-xs", icon: "w-8 h-8", box: "py-6" });
    expect(tileSizeClasses("md")).toEqual(tileSizeClasses());
  });

  it("lg : texte agrandi, icône en `size-*` (seule forme qui passe devant le `size-4` du Button), contenu calé en haut", () => {
    const lg = tileSizeClasses("lg");
    expect(lg.title).toContain("text-lg");
    expect(lg.subtitle).toBe("text-base");
    expect(lg.icon).toBe("size-8");
    expect(lg.box.split(" ")).toContain("justify-start");
  });
});

describe("tilesContainerWidth", () => {
  it("largeur historique par défaut, élargie en `wide`", () => {
    expect(tilesContainerWidth()).toBe("max-w-5xl");
    expect(tilesContainerWidth("default")).toBe("max-w-5xl");
    expect(tilesContainerWidth("wide")).toBe("max-w-7xl");
  });
});
