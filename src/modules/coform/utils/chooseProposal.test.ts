import { describe, it, expect } from "vitest";
import {
  isSelectedIn,
  getStoredContextName,
  getOtherSelections,
  buildChooseEntry,
  SELECTED,
  NOT_SELECTED,
} from "./chooseProposal";

/**
 * Forme relevée en base :
 * `{"615724525a88061a684d4916":{"value":"selected","type":"organizations",
 *   "name":"Appel à communs des tiers-lieux"}}`
 *
 * 59 réponses portent la clé, dont **9 avec 2 ou 3 contextes** : le scope par
 * contexte n'est pas une hypothèse, c'est ce que contient la base.
 */
const UN_CONTEXTE = {
  ctxA: { value: SELECTED, type: "organizations", name: "Appel à communs des tiers-lieux" },
};
const TROIS_CONTEXTES = {
  ctxA: { value: SELECTED, type: "organizations", name: "Costum A" },
  ctxB: { value: NOT_SELECTED, type: "organizations", name: "Costum B" },
  ctxC: { value: SELECTED, type: "projects", name: "Costum C" },
};

describe("isSelectedIn", () => {
  it("ne regarde QUE le contexte demandé", () => {
    expect(isSelectedIn(TROIS_CONTEXTES, "ctxA")).toBe(true);
    expect(isSelectedIn(TROIS_CONTEXTES, "ctxB")).toBe(false);
    expect(isSelectedIn(TROIS_CONTEXTES, "ctxC")).toBe(true);
  });

  it("non retenu par défaut : contexte absent, valeur vide ou inattendue", () => {
    // Une candidature ne se publie pas toute seule.
    expect(isSelectedIn(TROIS_CONTEXTES, "inconnu")).toBe(false);
    expect(isSelectedIn(UN_CONTEXTE, null)).toBe(false);
    expect(isSelectedIn(null, "ctxA")).toBe(false);
    expect(isSelectedIn({ ctxA: { value: "" } }, "ctxA")).toBe(false);
    expect(isSelectedIn({ ctxA: {} }, "ctxA")).toBe(false);
  });
});

describe("getStoredContextName", () => {
  it("rend le nom mémorisé au dernier choix", () => {
    expect(getStoredContextName(UN_CONTEXTE, "ctxA")).toBe("Appel à communs des tiers-lieux");
  });

  it("null quand il manque ou est vide", () => {
    expect(getStoredContextName({ ctxA: { value: SELECTED, name: "  " } }, "ctxA")).toBeNull();
    expect(getStoredContextName({ ctxA: { value: SELECTED } }, "ctxA")).toBeNull();
    expect(getStoredContextName(null, "ctxA")).toBeNull();
  });
});

describe("getOtherSelections", () => {
  it("liste les AUTRES contextes retenus — ce que le legacy ne montre pas", () => {
    // Sans cette information, un administrateur croit décider pour tout le monde.
    expect(getOtherSelections(TROIS_CONTEXTES, "ctxA")).toEqual([{ id: "ctxC", name: "Costum C" }]);
  });

  it("ignore les contextes NON retenus", () => {
    expect(getOtherSelections(TROIS_CONTEXTES, "ctxC")).toEqual([{ id: "ctxA", name: "Costum A" }]);
  });

  it("retombe sur l'identifiant quand le nom manque", () => {
    expect(getOtherSelections({ ctxZ: { value: SELECTED } }, "ctxA")).toEqual([
      { id: "ctxZ", name: "ctxZ" },
    ]);
  });

  it("vide quand il n'y a qu'un contexte, ou aucune valeur", () => {
    expect(getOtherSelections(UN_CONTEXTE, "ctxA")).toEqual([]);
    expect(getOtherSelections(null, "ctxA")).toEqual([]);
  });
});

describe("buildChooseEntry", () => {
  it("écrit l'objet complet, type et nom dénormalisés", () => {
    expect(
      buildChooseEntry({ id: "ctxA", type: "organizations", name: "Costum A" }, true)
    ).toEqual({ value: SELECTED, type: "organizations", name: "Costum A" });
  });

  it("écrit `notselected` — et non une suppression — quand on retire le choix", () => {
    // Retirer la clé perdrait l'information « on a tranché, c'est non ».
    expect(buildChooseEntry({ id: "ctxA", type: "organizations", name: "Costum A" }, false)).toEqual(
      { value: NOT_SELECTED, type: "organizations", name: "Costum A" }
    );
  });

  it("tolère un contexte sans type ni nom", () => {
    expect(buildChooseEntry({ id: "ctxA" }, true)).toEqual({
      value: SELECTED,
      type: null,
      name: null,
    });
  });
});
