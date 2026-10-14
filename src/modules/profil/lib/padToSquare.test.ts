import { describe, it, expect } from "vitest";
import { MAX_SQUARE_SIDE, squarePlacement } from "./padToSquare";

describe("squarePlacement", () => {
  it("image large : carré du côté de la largeur, image centrée verticalement", () => {
    expect(squarePlacement(900, 300)).toEqual({ size: 900, x: 0, y: 300, width: 900, height: 300 });
  });

  it("image haute : carré du côté de la hauteur, image centrée horizontalement", () => {
    expect(squarePlacement(300, 600)).toEqual({ size: 600, x: 150, y: 0, width: 300, height: 600 });
  });

  it("image carrée : aucun décalage", () => {
    expect(squarePlacement(500, 500)).toEqual({ size: 500, x: 0, y: 0, width: 500, height: 500 });
  });

  it("grande photo : carré plafonné, image réduite en gardant ses proportions", () => {
    // 4000×3000 donnait un carré de 4000 px (16 Mpx, PNG de plusieurs dizaines de Mo).
    expect(squarePlacement(4000, 3000)).toEqual({ size: MAX_SQUARE_SIDE, x: 0, y: 128, width: 1024, height: 768 });
    expect(squarePlacement(1000, 6000).size).toBe(MAX_SQUARE_SIDE);
  });

  it("jamais agrandie sous le plafond", () => {
    expect(squarePlacement(800, 400)).toMatchObject({ size: 800, width: 800, height: 400 });
  });
});
