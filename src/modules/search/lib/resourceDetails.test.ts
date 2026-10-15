import { describe, it, expect } from "vitest";
import { buildResourceDetails, readTagList, readText } from "./resourceDetails";

const label = (k: string) => `L:${k}`;

describe("buildResourceDetails", () => {
  it("listes puis textes, dans l'ordre de la fiche, blocs vides omis", () => {
    const values: Record<string, unknown> = {
      tip: "Un jardin",
      equipments: ["Wifi", " Paperboard "],
      about: "  ",
      catering: "Micro-ondes",
      moreInfo: "Accès PMR",
    };
    expect(buildResourceDetails((k) => values[k], label)).toEqual({
      tags: [
        { label: "L:equipments", values: ["Wifi", "Paperboard"] },
        { label: "L:catering", values: ["Micro-ondes"] },
      ],
      notes: [
        { label: "L:moreInfo", value: "Accès PMR" },
        { label: "L:tip", value: "Un jardin" },
      ],
    });
  });

  it("aucun champ renseigné : objet vide", () => {
    expect(buildResourceDetails(() => undefined, label)).toEqual({});
  });
});

describe("readTagList / readText", () => {
  it("tableau, chaîne seule, valeurs vides", () => {
    expect(readTagList(["a", "", 3])).toEqual(["a", "3"]);
    expect(readTagList("seul")).toEqual(["seul"]);
    expect(readTagList(null)).toEqual([]);
    expect(readText("  x ")).toBe("x");
    expect(readText(42)).toBe("");
  });
});
