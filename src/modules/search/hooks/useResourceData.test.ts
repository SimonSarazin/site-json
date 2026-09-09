import { describe, it, expect } from "vitest";
import { resolveBadgeLabel } from "./useResourceData";

/**
 * `badge.labels` existe pour les champs qui stockent une CLÉ (`mss`, `has`…) plutôt qu'un libellé :
 * sans lui la pastille afficherait la clé brute, en public. Le stockage reste la clé — c'est ce qui
 * permet à un site bilingue d'afficher deux libellés pour une même donnée.
 */
describe("resolveBadgeLabel", () => {
  const tLoc = (v: { fr?: string; en?: string }) => v.fr ?? "";
  const labels = { mss: { fr: "Maisons Sport Santé", en: "Sport Health Houses" } };

  it("résout la clé stockée en libellé localisé", () => {
    expect(resolveBadgeLabel("mss", labels, tLoc)).toBe("Maisons Sport Santé");
  });

  it("comparaison NORMALISÉE : casse et accents de la clé de config n'entrent pas en jeu", () => {
    expect(resolveBadgeLabel("MSS", labels, tLoc)).toBe("Maisons Sport Santé");
    expect(resolveBadgeLabel("mss", { "MSS": labels.mss }, tLoc)).toBe("Maisons Sport Santé");
  });

  it("valeur hors map : affichée telle quelle (pas de trou dans l'UI)", () => {
    expect(resolveBadgeLabel("inconnue", labels, tLoc)).toBe("inconnue");
  });

  it("sans map : comportement historique, la valeur stockée est le libellé", () => {
    expect(resolveBadgeLabel("Bonnes pratiques", undefined, tLoc)).toBe("Bonnes pratiques");
  });
});
