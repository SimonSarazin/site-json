import { describe, it, expect } from "vitest";
import { iconColorClass, iconHaloClass } from "./iconColorClass";

describe("iconColorClass", () => {
  it("rend les trois teintes nommées", () => {
    expect(iconColorClass("accent")).toBe("text-accent");
    expect(iconColorClass("chart-2")).toBe("text-chart-2");
    expect(iconColorClass("chart-3")).toBe("text-chart-3");
  });

  it("retombe sur primary pour `primary`, l'absence de valeur et une valeur inconnue", () => {
    expect(iconColorClass("primary")).toBe("text-primary");
    expect(iconColorClass(undefined)).toBe("text-primary");
    expect(iconColorClass("mauve")).toBe("text-primary");
  });

  it("garde le repli primary pour les valeurs du schéma que la table ne traite pas — 2 cartes du parc déclarent `turquoise` et rendent ainsi depuis toujours", () => {
    expect(iconColorClass("turquoise")).toBe("text-primary");
    expect(iconColorClass("cyan-bright")).toBe("text-primary");
    expect(iconColorClass("turquoise-light")).toBe("text-primary");
  });

  it("ne renvoie que des classes littérales, scannables par le JIT", () => {
    for (const c of ["accent", "chart-2", "chart-3", "primary", undefined]) {
      expect(iconColorClass(c)).toMatch(/^text-[a-z0-9-]+$/);
    }
  });
});

describe("iconHaloClass", () => {
  it("teinte la pastille pour les trois jetons nommés", () => {
    expect(iconHaloClass("accent")).toBe("bg-accent/30 group-hover:bg-accent/40");
    expect(iconHaloClass("chart-2")).toBe("bg-chart-2/30 group-hover:bg-chart-2/40");
    expect(iconHaloClass("chart-3")).toBe("bg-chart-3/30 group-hover:bg-chart-3/40");
  });

  it("retombe sur la pastille primary historique", () => {
    expect(iconHaloClass("primary")).toBe("bg-primary/10 group-hover:bg-primary/20");
    expect(iconHaloClass(undefined)).toBe("bg-primary/10 group-hover:bg-primary/20");
    expect(iconHaloClass("mauve")).toBe("bg-primary/10 group-hover:bg-primary/20");
  });

  it("porte son état de survol, qui était en dur avant l'extraction", () => {
    for (const c of ["accent", "chart-2", "chart-3", "primary", undefined]) {
      expect(iconHaloClass(c)).toMatch(/^bg-[a-z0-9-]+\/\d+ group-hover:bg-[a-z0-9-]+\/\d+$/);
    }
  });

  it("couvre exactement les mêmes jetons que la teinte de glyphe", () => {
    for (const c of ["accent", "chart-2", "chart-3", "primary", undefined, "inconnu"]) {
      const parDefaut = iconColorClass(c) === "text-primary";
      expect(iconHaloClass(c) === "bg-primary/10 group-hover:bg-primary/20").toBe(parDefaut);
    }
  });
});
