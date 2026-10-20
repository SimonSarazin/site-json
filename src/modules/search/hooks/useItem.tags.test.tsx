// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import useItem from "./useItem";
import type { Organization } from "@communecter/cocolight-api-client";

const tagsOf = (tags: unknown) =>
  renderHook(() => useItem({ serverData: { name: "X", tags } } as unknown as Organization)).result.current.tags;

/** `tags` arrive du backend sous trois formes ; toutes les cartes lisent un tableau de chaînes. */
describe("useItem — normalisation des tags", () => {
  it("tableau : chaînes non vides seules, ordre préservé (le dédoublonnage appartient au lecteur)", () => {
    expect(tagsOf(["a", 1, "b", ""])).toEqual(["a", "b"]);
  });

  it("tableau PHP à trous ({\"1\": …}) : les valeurs — et non les index — sont les tags", () => {
    expect(tagsOf({ "1": "Pedagogie", "3": "Santé" })).toEqual(["Pedagogie", "Santé"]);
  });

  it("dictionnaire de présence ({tag: true}) : les clés (comportement historique conservé)", () => {
    expect(tagsOf({ Pedagogie: true })).toEqual(["Pedagogie"]);
  });
});
