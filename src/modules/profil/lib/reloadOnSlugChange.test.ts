import { describe, it, expect } from "vitest";
import { replaceSlugSegment } from "./reloadOnSlugChange";

describe("replaceSlugSegment — le slug est un SEGMENT du chemin, pas une sous-chaîne", () => {
  it("remplace le segment du profil", () => {
    expect(replaceSlugSegment("/profil/jeantest", "jeantest", "jean-test")).toBe("/profil/jean-test");
  });

  it("garde l'onglet qui suit", () => {
    expect(replaceSlugSegment("/profil/jeantest/agenda", "jeantest", "jt")).toBe("/profil/jt/agenda");
  });

  it("un slug préfixe d'un autre segment (`pro` dans `profil`) ne touche pas ce segment", () => {
    expect(replaceSlugSegment("/profil/pro", "pro", "prolo")).toBe("/profil/prolo");
  });

  it("chemin sans le slug : inchangé", () => {
    expect(replaceSlugSegment("/profil/autre", "jeantest", "jt")).toBe("/profil/autre");
  });
});
