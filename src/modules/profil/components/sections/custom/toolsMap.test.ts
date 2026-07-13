import { describe, it, expect } from "vitest";
import { parseRows, rowsToOurTools, type ToolRow } from "./toolsMap";

describe("parseRows", () => {
  it("données absentes / invalides → []", () => {
    expect(parseRows(undefined)).toEqual([]);
    expect(parseRows(null)).toEqual([]);
    expect(parseRows([])).toEqual([]);
    expect(parseRows("x")).toEqual([]);
  });

  it("aplatit ourTools en lignes, ids 0..n-1", () => {
    const rows = parseRows({
      site: [{ name: "Site A", url: "https://a" }],
      reservation: [{ name: "Dokos", url: "https://d" }, { name: "Autre" }],
    });
    expect(rows).toEqual([
      { id: 0, category: "site", name: "Site A", url: "https://a" },
      { id: 1, category: "reservation", name: "Dokos", url: "https://d" },
      { id: 2, category: "reservation", name: "Autre", url: "" },
    ]);
  });

  it("ignore les catégories hors TOOLS_MAP et les valeurs non-array", () => {
    const rows = parseRows({
      site: [{ name: "S" }],
      inconnue: [{ name: "X" }],
      reservation: "pasunarray",
    });
    expect(rows).toEqual([{ id: 0, category: "site", name: "S", url: "" }]);
  });
});

describe("rowsToOurTools", () => {
  const R = (partial: Partial<ToolRow>): ToolRow => ({ id: 0, category: "site", name: "", url: "", ...partial });

  it("round-trip parse → rowsToOurTools préserve les données connues", () => {
    const raw = {
      site: [{ name: "Site A", url: "https://a" }],
      reservation: [{ name: "Dokos", url: "https://d" }],
    };
    expect(rowsToOurTools(parseRows(raw), raw)).toEqual(raw);
  });

  it("regroupe plusieurs lignes d'une même catégorie", () => {
    const rows = [
      R({ id: 0, category: "site", name: "A", url: "https://a" }),
      R({ id: 1, category: "site", name: "B" }),
    ];
    expect(rowsToOurTools(rows, undefined)).toEqual({
      site: [{ name: "A", url: "https://a" }, { name: "B" }],
    });
  });

  it("préserve les catégories inconnues présentes en base (pas de perte au $set)", () => {
    const raw = { customTool: [{ name: "Legacy", url: "https://legacy" }] };
    const rows = [R({ category: "site", name: "Site" })];
    expect(rowsToOurTools(rows, raw)).toEqual({
      customTool: [{ name: "Legacy", url: "https://legacy" }],
      site: [{ name: "Site" }],
    });
  });

  it("droppe les lignes entièrement vides, garde les lignes url-only", () => {
    const rows = [
      R({ id: 0, category: "site", name: "", url: "" }),
      R({ id: 1, category: "reservation", name: "", url: "https://only" }),
    ];
    expect(rowsToOurTools(rows, undefined)).toEqual({
      reservation: [{ name: "", url: "https://only" }],
    });
  });

  it("trim les valeurs", () => {
    const rows = [R({ category: "site", name: "  A  ", url: "  https://a  " })];
    expect(rowsToOurTools(rows, undefined)).toEqual({ site: [{ name: "A", url: "https://a" }] });
  });

  it("aucune ligne exploitable → {} (le call-site enverra null)", () => {
    expect(rowsToOurTools([], undefined)).toEqual({});
    expect(rowsToOurTools([R({ name: "", url: "" })], undefined)).toEqual({});
  });

  it("ignore une catégorie de ligne hors TOOLS_MAP", () => {
    const rows = [R({ category: "inconnue", name: "X", url: "https://x" })];
    expect(rowsToOurTools(rows, undefined)).toEqual({});
  });
});
