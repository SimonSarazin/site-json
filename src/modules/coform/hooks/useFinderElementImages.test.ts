import { describe, it, expect } from "vitest";
import {
  finderElementsNeedingImage,
  mergeResolvedFinderImages,
} from "./useFinderElementImages";
import type { FinderValue } from "../types";

const value: FinderValue = {
  org1: { id: "org1", name: "Tiers-lieu A", type: "organizations" }, // pas d'img → à résoudre
  org2: { id: "org2", name: "Tiers-lieu B", type: "organizations", img: "/upload/b.jpg" }, // img présent
  thing1: { id: "thing1", name: "Objet", type: "things" }, // type non résoluble
};

describe("finderElementsNeedingImage", () => {
  it("ne retient que les éléments sans img ET de type résoluble", () => {
    const out = finderElementsNeedingImage(value);
    expect(out.map((e) => e.id)).toEqual(["org1"]);
  });

  it("ignore un img vide string et le retient", () => {
    const v: FinderValue = { p: { id: "p", name: "P", type: "citoyens", img: "" } };
    expect(finderElementsNeedingImage(v).map((e) => e.id)).toEqual(["p"]);
  });

  it("ignore une entrée sans id", () => {
    const v = { x: { id: "", name: "X", type: "projects" } } as unknown as FinderValue;
    expect(finderElementsNeedingImage(v)).toEqual([]);
  });

  it("renvoie [] pour une valeur null", () => {
    expect(finderElementsNeedingImage(null)).toEqual([]);
  });
});

describe("mergeResolvedFinderImages", () => {
  it("injecte l'image résolue uniquement quand img est absent", () => {
    const merged = mergeResolvedFinderImages(value, {
      org1: "https://api.example.com/upload/a.jpg",
    });
    const byId = Object.fromEntries(merged.map((e) => [e.id, e.img]));
    expect(byId.org1).toBe("https://api.example.com/upload/a.jpg");
    // img déjà présent : non écrasé.
    expect(byId.org2).toBe("/upload/b.jpg");
    // non résolu : reste sans img (fallback icône).
    expect(byId.thing1).toBeUndefined();
  });

  it("ne mute pas les éléments d'origine (copie d'affichage)", () => {
    const resolved = { org1: "https://api.example.com/upload/a.jpg" };
    mergeResolvedFinderImages(value, resolved);
    expect(value.org1.img).toBeUndefined();
  });

  it("renvoie l'élément tel quel si aucune image résolue pour son id", () => {
    const merged = mergeResolvedFinderImages(value, {});
    expect(merged.find((e) => e.id === "org1")?.img).toBeUndefined();
  });

  it("renvoie [] pour une valeur null", () => {
    expect(mergeResolvedFinderImages(null, {})).toEqual([]);
  });
});
