/** Détection d'une section cagnotte dans une liste de sections, imbriquées comprises. */
import { describe, it, expect } from "vitest";
import { hasCagnotteSection } from "./cagnotteSections";

describe("hasCagnotteSection", () => {
  it("section cagnotte au premier niveau", () => {
    expect(hasCagnotteSection([{ type: "news" }, { type: "finance" }])).toBe(true);
  });

  it("dans un `cagnotte-layout` (props.leftSections / props.rightSections)", () => {
    expect(hasCagnotteSection([{ type: "cagnotte-layout", props: { leftSections: [{ type: "actions" }] } }])).toBe(true);
    expect(hasCagnotteSection([{ type: "cagnotte-layout", props: { rightSections: [{ type: "finance-summary" }] } }])).toBe(true);
  });

  it("dans un `profile-tab-layout` (leftSections / rightSections)", () => {
    expect(hasCagnotteSection([{ type: "profile-tab-layout", leftSections: [{ type: "profile-about" }], rightSections: [{ type: "actions-summary" }] }])).toBe(true);
  });

  it("aucune section cagnotte", () => {
    expect(hasCagnotteSection([{ type: "profile-tab-layout", leftSections: [{ type: "profile-about" }] }, { type: "news" }])).toBe(false);
    expect(hasCagnotteSection([{ type: "cagnotte-layout", props: { leftSections: [] } }])).toBe(false);
  });
});
