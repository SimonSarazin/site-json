import { describe, expect, it } from "vitest";
import { firstParent } from "./formParent";

describe("firstParent", () => {
  it("rend la 1re entrée de form.parent, avec son type et son nom", () => {
    expect(
      firstParent({
        parent: {
          "677e7e13bd08b2478f5f5314": { type: "organizations", name: "Fédération des CAE" },
          autre: { type: "projects", name: "Ignoré" },
        },
      }),
    ).toEqual({ id: "677e7e13bd08b2478f5f5314", type: "organizations", name: "Fédération des CAE" });
  });

  it("tolère un parent sans type ni nom — l'id suffit à désigner le contexte", () => {
    expect(firstParent({ parent: { abc: {} } })).toEqual({ id: "abc", type: null, name: null });
  });

  it("rend null quand il n'y a pas de parent exploitable", () => {
    expect(firstParent(null)).toBeNull();
    expect(firstParent({})).toBeNull();
    expect(firstParent({ parent: null })).toBeNull();
    expect(firstParent({ parent: {} })).toBeNull();
    expect(firstParent({ parent: [] })).toBeNull();
    expect(firstParent({ parent: "677e7e13bd08b2478f5f5314" })).toBeNull();
  });
});
