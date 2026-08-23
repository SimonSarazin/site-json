import { describe, it, expect } from "vitest";
import { buildToolsPayload } from "./buildToolsPayload";

describe("buildToolsPayload", () => {
  it("n'émet ni name ni filters quand la query est vide", () => {
    expect(buildToolsPayload({}, 24)).toEqual({ indexStep: 24 });
  });

  it("trim le terme de recherche et l'omet s'il est vide", () => {
    expect(buildToolsPayload({ search: "  jitsi  " }, 24)).toEqual({ name: "jitsi", indexStep: 24 });
    expect(buildToolsPayload({ search: "   " }, 24)).toEqual({ indexStep: 24 });
  });

  it("n'inclut que les filtres non vides", () => {
    expect(buildToolsPayload({ category: "Visio", usage: "" }, 12)).toEqual({
      filters: { category: "Visio" },
      indexStep: 12,
    });
  });

  it("garde isOpenSource=false (coercition boolean, pas de troncature falsy)", () => {
    expect(buildToolsPayload({ isOpenSource: false }, 24)).toEqual({
      filters: { isOpenSource: false },
      indexStep: 24,
    });
    expect(buildToolsPayload({ isOpenSource: undefined }, 24)).toEqual({ indexStep: 24 });
  });

  it("combine recherche + filtres + indexStep", () => {
    expect(
      buildToolsPayload({ search: "mattermost", category: "Chat", isOpenSource: true }, 48),
    ).toEqual({
      name: "mattermost",
      filters: { category: "Chat", isOpenSource: true },
      indexStep: 48,
    });
  });
});
