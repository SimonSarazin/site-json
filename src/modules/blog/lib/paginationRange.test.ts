import { describe, it, expect } from "vitest";
import { buildPageRange } from "./paginationRange";

describe("buildPageRange", () => {
  it("peu de pages : affiche tout, aucune ellipse", () => {
    expect(buildPageRange(5, 2)).toEqual([0, 1, 2, 3, 4]);
    expect(buildPageRange(7, 0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("page courante proche du début : ellipse à droite seulement", () => {
    expect(buildPageRange(20, 1)).toEqual([0, 1, 2, 3, 4, "ellipsis", 19]);
  });

  it("page courante proche de la fin : ellipse à gauche seulement", () => {
    expect(buildPageRange(20, 18)).toEqual([0, "ellipsis", 15, 16, 17, 18, 19]);
  });

  it("page courante au milieu : ellipse des deux côtés", () => {
    expect(buildPageRange(40, 20)).toEqual([0, "ellipsis", 19, 20, 21, "ellipsis", 39]);
  });

  it("32 pages visitées (cas rapporté) : 7 boutons au lieu de 32, plus de retour à la ligne", () => {
    const range = buildPageRange(32, 31);
    expect(range).toEqual([0, "ellipsis", 27, 28, 29, 30, 31]);
    expect(range.length).toBe(7);
  });

  it("pas d'ellipse en dessous du seuil de troncature (ici : masquerait une seule page)", () => {
    // Page 3 sur 7 (0-indexé, dernière page = 6) : tient tout entier dans `totalVisible` (7) —
    // le détour par une ellipse masquerait une seule page (ni plus court, ni plus lisible).
    expect(buildPageRange(7, 3)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("la DERNIÈRE page du range est toujours pageCount-1, jamais une page jamais chargée", () => {
    // `pageCount` (cf. `usePagedFeedNav`) ne grandit QU'avec les pages réellement chargées en
    // cache — jamais au-delà. `buildPageRange` montre donc toujours la vraie dernière page du fil
    // UNE FOIS qu'elle a été atteinte (le curseur backend ne permet aucun saut direct vers elle
    // avant ça), jamais une page devinée/non chargée. Vérifié en direct : /appels-a-projets (8
    // pages), en revenant sur la page 1 après avoir atteint la page 8, le bouton « 8 » reste
    // affiché dans la troncature ; avant de l'avoir atteinte, il est absent.
    const range = buildPageRange(8, 0);
    expect(range).toContain(7);
    expect(range[range.length - 1]).toBe(7);
  });
});
