import { describe, expect, it } from "vitest";
import {
  canManageObjectiveActions,
  normalizeActionForEdit,
  resolveCommunOwnerIds,
  fundableItemToMilestone,
  fundableItemToMilestoneRef,
  toMilestoneStatus,
} from "./objectiveHelpers";
import type { CagnotteFundableItem } from "@/modules/cagnotte/types";

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

/**
 * `useCagnotteAdapter` pose `depenseIndex: matchedDepense?.index ?? -1`, où `-1` est
 * la SENTINELLE « ce palier projet n'a pas de dépense associée ». Elle ne doit jamais
 * ressortir comme un index : la chaîne de mutation lui donne priorité sur l'index
 * résolu et écrirait dans `answers.<step>.depense.-1`.
 */
describe("fundableItemToMilestone — la sentinelle -1 ne sort pas", () => {
  const item = (over: Partial<CagnotteFundableItem> = {}) =>
    ({
      fromType: "depense",
      itemId: "i1",
      milestoneId: "m1",
      depenseIndex: 0,
      name: "Palier",
      price: 100,
      status: "open",
      actions: [],
      funding: [],
      currentFunding: 0,
      unpaidFunding: 0,
      userPledge: 0,
      allFunding: [],
      ...over,
    }) as CagnotteFundableItem;

  it("garde un index réel, y compris 0", () => {
    expect(fundableItemToMilestone(item({ depenseIndex: 0 })).answerDepenseIndex).toBe(0);
    expect(fundableItemToMilestoneRef(item({ depenseIndex: 3 })).answerDepenseIndex).toBe(3);
  });

  it("écarte la sentinelle -1, sur les deux formes", () => {
    expect(fundableItemToMilestone(item({ depenseIndex: -1 })).answerDepenseIndex).toBeUndefined();
    expect(fundableItemToMilestoneRef(item({ depenseIndex: -1 })).answerDepenseIndex).toBeUndefined();
  });

  it("reporte les champs du palier sans les inventer", () => {
    const m = fundableItemToMilestone(item({ name: "Serveur", price: 250, description: undefined }));
    expect(m.title).toBe("Serveur");
    expect(m.targetAmount).toBe(250);
    expect(m.description).toBe("");
  });
});

describe("toMilestoneStatus", () => {
  it("laisse passer les trois valeurs du domaine", () => {
    expect(toMilestoneStatus("open")).toBe("open");
    expect(toMilestoneStatus("done")).toBe("done");
    expect(toMilestoneStatus("close")).toBe("close");
  });

  it("traite tout statut inconnu comme ouvert — jamais figé par erreur", () => {
    expect(toMilestoneStatus(undefined)).toBe("open");
    expect(toMilestoneStatus("")).toBe("open");
    expect(toMilestoneStatus("archivé")).toBe("open");
  });
});
