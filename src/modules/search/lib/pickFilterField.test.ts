import { describe, it, expect } from "vitest";
import { pickFilterField } from "./pickFilterField";

describe("pickFilterField — matrice config → widget", () => {
  it("absent → null (accordéon, pas de widget compact)", () => {
    expect(pickFilterField(undefined)).toBeNull();
  });

  it("{} → select simple", () => {
    expect(pickFilterField({})).toBe("select");
  });

  it("{ multiple } → combobox multi (coche à droite)", () => {
    expect(pickFilterField({ multiple: true })).toBe("multi-checkbox");
  });

  it("{ searchable } → recherche, sélection unique (remplace)", () => {
    expect(pickFilterField({ searchable: true })).toBe("multi-single");
  });

  it("{ multiple, searchable } → recherche + badges multi", () => {
    expect(pickFilterField({ multiple: true, searchable: true })).toBe("multi");
  });

  it("searchable l'emporte sur multiple pour décider de la RECHERCHE", () => {
    // multiple seul = combobox sans recherche ; dès que searchable, on bascule
    // sur MultipleSelector (avec ou sans badges selon multiple).
    expect(pickFilterField({ multiple: false, searchable: true })).toBe("multi-single");
    expect(pickFilterField({ multiple: true, searchable: false })).toBe("multi-checkbox");
  });
});
