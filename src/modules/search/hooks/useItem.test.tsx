// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import useItem from "./useItem";
import type { Organization } from "@communecter/cocolight-api-client";

/**
 * Priorité de résolution d'image — `useItem` alimente TOUTES les cartes de
 * recherche, pas seulement les événements. L'ordre est un contrat de
 * performance autant que d'affichage : les déclinaisons dérivées d'abord (plus
 * légères), l'originale seulement en dernier recours.
 *
 * `profilImageUrl` en dernier recours n'est pas décoratif : `searchEventsCostum`
 * ne projette QUE ce champ (ni medium ni thumb), si bien que tout événement
 * était rendu SANS image alors qu'il en avait une.
 */
function ent(serverData: Record<string, unknown>) {
  return { serverData } as unknown as Organization;
}
const img = (sd: Record<string, unknown>) => renderHook(() => useItem(ent(sd))).result.current.image;

describe("useItem — résolution de l'image", () => {
  it("medium gagne sur thumb et sur l'originale", () => {
    expect(
      img({
        profilMediumImageUrl: "/m.jpg",
        profilThumbImageUrl: "/t.jpg",
        profilImageUrl: "/o.jpg",
      }),
    ).toBe("/m.jpg");
  });

  it("sans medium : thumb gagne sur l'originale", () => {
    expect(img({ profilThumbImageUrl: "/t.jpg", profilImageUrl: "/o.jpg" })).toBe("/t.jpg");
  });

  it("🔒 sans aucune déclinaison dérivée : repli sur l'originale", () => {
    // Le cas de searchEventsCostum, qui ne projette que ce champ.
    expect(img({ profilImageUrl: "/o.jpg" })).toBe("/o.jpg");
  });

  it("aucune des trois : chaîne vide (les cartes basculent sur leur variante sans image)", () => {
    expect(img({ name: "Sans visuel" })).toBe("");
  });

  it("champ présent mais vide : traité comme absent, pas comme une URL", () => {
    expect(img({ profilMediumImageUrl: "", profilImageUrl: "/o.jpg" })).toBe("/o.jpg");
    expect(img({ profilImageUrl: "" })).toBe("");
  });
});
