import { describe, expect, it } from "vitest";
import { canManageObjectiveActions, normalizeActionForEdit, resolveCommunOwnerIds } from "./objectiveHelpers";

describe("resolveCommunOwnerIds", () => {
  it("retient le déposant, quel que soit le visiteur", () => {
    expect(resolveCommunOwnerIds({ userId: "deposant" })).toEqual(["deposant"]);
  });

  /**
   * Porter l'appel donne le droit de sélectionner, valider et promouvoir un commun —
   * pas d'écrire dans son plan de financement à la place du déposant. L'admin de
   * l'appel obtient paliers et actions par le PROJET lié quand il l'administre,
   * jamais par sa qualité d'admin de l'appel.
   */
  it("ne retient PAS l'admin de l'appel : ce n'est pas lui qui porte le commun", () => {
    expect(resolveCommunOwnerIds({ userId: "deposant" })).not.toContain("admin-cae");
  });

  it("lit `userId` et non `user` — sur un commun porté par une orga, `user` est l'ORGA", () => {
    const communPorteParUneOrga = { userId: "deposant", user: { _id: "org-42" } };
    expect(resolveCommunOwnerIds(communPorteParUneOrga)).toEqual(["deposant"]);
  });

  it("rend une liste vide quand la réponse ne dit pas qui l'a déposée", () => {
    expect(resolveCommunOwnerIds(null)).toEqual([]);
    expect(resolveCommunOwnerIds({})).toEqual([]);
  });
});

describe("canManageObjectiveActions", () => {
  it("exige un projet — une proposition non promue n'a pas d'actions", () => {
    expect(canManageObjectiveActions("proj-1")).toBe(true);
    expect(canManageObjectiveActions("")).toBe(false);
    expect(canManageObjectiveActions("   ")).toBe(false);
    expect(canManageObjectiveActions(null)).toBe(false);
    expect(canManageObjectiveActions(undefined)).toBe(false);
  });
});

describe("normalizeActionForEdit", () => {
  it("dédoublonne les tags — le legacy les persiste en double à la création", () => {
    // Ce que `/costum/project/action/request/new` écrit pour un `tags: ["design"]` posté.
    const action = normalizeActionForEdit({ name: "Maquettes", tags: ["design", "design"] });
    expect(action.tags).toEqual(["design"]);
  });

  it("écarte les tags vides et les valeurs non-string", () => {
    const action = normalizeActionForEdit({ tags: ["ux", "", null, 42, "ux"] });
    expect(action.tags).toEqual(["ux"]);
  });

  it("expose l'auteur, `creator` d'abord puis `idUserAuthor`", () => {
    expect(normalizeActionForEdit({ creator: "u1", idUserAuthor: "u2" }).authorId).toBe("u1");
    expect(normalizeActionForEdit({ idUserAuthor: "u2" }).authorId).toBe("u2");
    // Documents anciens : personne n'est déclaré — l'action reste éditable par l'admin seul.
    expect(normalizeActionForEdit({ name: "Sans auteur" }).authorId).toBe("");
  });
});
