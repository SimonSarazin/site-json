import { describe, expect, it } from "vitest";

import { csvExportFields } from "./csvExportFields";

describe("csvExportFields", () => {
  it("ajoute les champs de l'export à ceux de la liste, sans doublon", () => {
    expect(csvExportFields(["name", "email"], ["email", "telephone"])).toEqual(["name", "email", "telephone"]);
  });

  it("sans champs d'export : ceux de la liste", () => {
    expect(csvExportFields(["name"])).toEqual(["name"]);
  });

  it("sans projection de liste : aucune projection imposée", () => {
    expect(csvExportFields(undefined, ["email"])).toBeUndefined();
    expect(csvExportFields([], ["email"])).toBeUndefined();
  });
});
