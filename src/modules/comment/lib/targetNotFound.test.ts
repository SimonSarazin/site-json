import { describe, expect, it } from "vitest";
import { TargetNotFoundError, isMissingDocument } from "./targetNotFound";
import type { CommentTarget } from "../types";

/**
 * Ce prédicat décide si l'on affirme à l'utilisateur qu'une discussion n'existe plus. Se
 * tromper dans un sens montre un fil vide à tort — désagréable ; se tromper dans l'autre
 * décourage d'écrire là où c'est parfaitement possible. D'où ces bornes, toutes prises sur
 * des formes MESURÉES le 24/09 contre `/co2/element/about`.
 */
describe("isMissingDocument", () => {
  it("laisse passer une entité réellement chargée", () => {
    // Forme exacte rendue pour une organisation existante.
    expect(isMissingDocument({ serverData: {
      _id: { $id: "631af7bd98cd2e3d292633dd" }, collection: "organizations",
      name: "Open Organisation", slug: "openOrganisation", type: "LocalBusiness",
    } })).toBe(false);
  });

  it("laisse passer une entité dont le SDK a normalisé l'identifiant en `id`", () => {
    expect(isMissingDocument({ serverData: { id: "631af7bd98cd2e3d292633dd", name: "Un projet" } }))
      .toBe(false);
  });

  it("reconnaît le substitut rendu pour un identifiant inconnu", () => {
    // Forme exacte rendue par le backend : un nom, aucun identifiant de document.
    expect(isMissingDocument({ serverData: {
      name: "Unknown (deleted)", slug: "unknown", type: "organizations", typeSig: "organizations",
    } })).toBe(true);
  });

  it("ne conclut RIEN d'une coquille sans données", () => {
    // `createFromCollection` en construit une pour `news` et `actions` : elle n'a jamais de
    // données, ce qui est normal et ne dit rien de l'existence du fil.
    expect(isMissingDocument({ serverData: undefined })).toBe(false);
    expect(isMissingDocument({ serverData: {} })).toBe(false);
    expect(isMissingDocument({})).toBe(false);
    expect(isMissingDocument(null)).toBe(false);
  });

  it("ne se fie pas au libellé anglais du legacy", () => {
    // Même nom, mais le document existe : le critère est l'identifiant, pas la chaîne.
    expect(isMissingDocument({ serverData: { _id: { $id: "abc" }, name: "Unknown (deleted)" } }))
      .toBe(false);
  });
});

describe("TargetNotFoundError", () => {
  it("porte la cible, pour que l'appelant puisse la nommer", () => {
    const target: CommentTarget = { type: "organizations", id: "631af7bd98cd2e3d292633dd", path: null };
    const err = new TargetNotFoundError(target);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("TargetNotFoundError");
    expect(err.target).toBe(target);
  });
});
