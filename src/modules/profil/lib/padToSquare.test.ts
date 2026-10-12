import { describe, it, expect } from "vitest";
import { squarePlacement } from "./padToSquare";

describe("squarePlacement", () => {
  it("image large : carré du côté de la largeur, image centrée verticalement", () => {
    expect(squarePlacement(1200, 400)).toEqual({ size: 1200, x: 0, y: 400 });
  });

  it("image haute : carré du côté de la hauteur, image centrée horizontalement", () => {
    expect(squarePlacement(300, 600)).toEqual({ size: 600, x: 150, y: 0 });
  });

  it("image carrée : aucun décalage", () => {
    expect(squarePlacement(500, 500)).toEqual({ size: 500, x: 0, y: 0 });
  });
});
