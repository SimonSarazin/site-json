import { describe, it, expect } from "vitest";

import {
  ANSWER_OWNER_FIELDS,
  countByStatus,
  defaultOpenStructures,
  managedAnswersParams,
  scheduleSummary,
  slotsSummaryLabels,
  structureAnswersFilters,
  structureModeration,
  submittedAnswersFilters,
  submittedSlotStructures,
  summarizeSlots,
  weekdayPresence,
} from "./managedStructures";

describe("countByStatus", () => {
  it("compte chaque statut, les absents à zéro", () => {
    expect(countByStatus(["pending", "validated", "validated"])).toEqual({
      pending: 1,
      inProgress: 0,
      validated: 2,
      refused: 0,
    });
  });
});

describe("summarizeSlots — résumé de l'en-tête d'une structure", () => {
  it("liste complète : compteurs non nuls, ce qui attend une action d'abord", () => {
    expect(summarizeSlots(["validated", "pending", "validated", "refused"], true)).toEqual({
      kind: "counts",
      counts: [
        { key: "pending", count: 1 },
        { key: "validated", count: 2 },
        { key: "refused", count: 1 },
      ],
    });
  });

  it("liste complète et vide : aucun créneau", () => {
    expect(summarizeSlots([], true)).toEqual({ kind: "none" });
  });

  it("liste incomplète : le nombre chargé seulement, jamais des compteurs qui se liraient comme des totaux", () => {
    expect(summarizeSlots(["validated", "pending"], false)).toEqual({ kind: "partial", count: 2 });
  });
});

describe("structureAnswersFilters — créneaux d'une structure", () => {
  const FORM = "6928096adf5caf0d230e7f26";
  const FINDER = "answers.s1.finders1abc";

  it("formulaire + finder qui cite la structure, $exists à true (jamais l'id en valeur)", () => {
    expect(structureAnswersFilters(FORM, FINDER, "org1")).toEqual({
      form: FORM,
      "answers.s1.finders1abc.org1": { $exists: true },
    });
  });

  it("préfixe `answers.` ajouté si la config l'omet", () => {
    expect(structureAnswersFilters(FORM, "s1.finders1abc", "org1")).toEqual(structureAnswersFilters(FORM, FINDER, "org1"));
  });
});

describe("weekdayPresence — bande de la semaine", () => {
  it("lundi → dimanche, vrai seulement les jours qui ont une plage", () => {
    expect(
      weekdayPresence([
        { dayKey: "monday", times: ["9H00 - 10H30"] },
        { dayKey: "wednesday", times: ["9H00 - 10H30"] },
        { dayKey: "friday", times: [] },
      ]),
    ).toEqual([true, false, true, false, false, false, false]);
  });

  it("aucun horaire : sept jours libres", () => {
    expect(weekdayPresence([])).toEqual([false, false, false, false, false, false, false]);
  });
});

describe("scheduleSummary — résumé horaire d'une ligne", () => {
  it("une même heure sur plusieurs jours = une seule plage", () => {
    expect(
      scheduleSummary([
        { dayKey: "monday", times: ["9H00 - 10H30"] },
        { dayKey: "thursday", times: ["9H00 - 10H30"] },
      ]),
    ).toEqual({ first: "9H00 - 10H30", more: 0 });
  });

  it("compte les AUTRES plages distinctes", () => {
    expect(
      scheduleSummary([
        { dayKey: "monday", times: ["9H00 - 10H30", "18H00 - 19H00"] },
        { dayKey: "tuesday", times: ["14H00 - 15H00"] },
      ]),
    ).toEqual({ first: "9H00 - 10H30", more: 2 });
  });

  it("sans horaire : rien à résumer", () => {
    expect(scheduleSummary([])).toEqual({ first: null, more: 0 });
  });
});

describe("defaultOpenStructures — structures dépliées à l'ouverture", () => {
  it("jusqu'à trois : toutes", () => {
    expect(defaultOpenStructures(["a", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(defaultOpenStructures([])).toEqual([]);
  });

  it("au-delà : la première seule (borne les requêtes lancées d'emblée)", () => {
    expect(defaultOpenStructures(["a", "b", "c", "d"])).toEqual(["a"]);
  });
});

describe("managedAnswersParams — paramètres d'une liste de créneaux de l'onglet", () => {
  it("réponses du formulaire, toutes provenances, les plus récentes d'abord ; champs projetés en option", () => {
    expect(managedAnswersParams({ form: "f" })).toEqual({
      defaultTypes: ["answers"],
      notSourceKey: true,
      indexStepList: 50,
      defaultSortBy: { created: -1 },
      defaultFilters: { form: "f" },
    });
    expect(managedAnswersParams({ form: "f" }, ANSWER_OWNER_FIELDS).defaultFields).toEqual(["user"]);
  });
});

describe("submittedAnswersFilters — créneaux déposés par le compte", () => {
  it("le formulaire et l'auteur, en CHAÎNE (la forme que le hook SSBE reconnaît)", () => {
    const form = "6928096adf5caf0d230e7f26";
    expect(submittedAnswersFilters(form, "6448f244ecf6e50e4b539677")).toEqual({ form, user: "6448f244ecf6e50e4b539677" });
  });
});

describe("submittedSlotStructures — place d'un créneau déposé dans l'onglet", () => {
  const A = "5f0f0f0f0f0f0f0f0f0f0f0a";
  const B = "5f0f0f0f0f0f0f0f0f0f0f0b";
  const listees = new Set([A]);

  it("écarté s'il cite une structure LISTÉE, où qu'elle soit dans le finder (une ligne à un seul endroit)", () => {
    expect(submittedSlotStructures([{ id: A, name: "Listée" }, { id: B, name: "Autre" }], undefined, listees)).toBeNull();
    expect(submittedSlotStructures([{ id: B, name: "Autre" }, { id: A, name: "Listée" }], undefined, listees)).toBeNull();
  });

  it("sinon : les noms du finder, à défaut celui de la structure jointe", () => {
    expect(submittedSlotStructures([{ id: B, name: "MAIRIE DU TAMPON" }], "ignorée", listees)).toEqual({ names: ["MAIRIE DU TAMPON"], count: 1 });
    expect(submittedSlotStructures([{ id: B, name: "" }], "MAIRIE DU TAMPON", listees)).toEqual({ names: ["MAIRIE DU TAMPON"], count: 1 });
  });

  it("des structures sans aucun nom restent des structures (compte > 0) ; aucune structure : compte 0", () => {
    expect(submittedSlotStructures([{ id: B, name: "" }], undefined, listees)).toEqual({ names: [], count: 1 });
    expect(submittedSlotStructures([], "ignorée", listees)).toEqual({ names: [], count: 0 });
  });
});

describe("structureModeration — statut d'une structure à signaler", () => {
  it("« Validé » : rien à signaler", () => {
    expect(structureModeration({ statusActor: "Validé" }, "statusActor")).toBeNull();
  });

  it("« Refusé » et la graphie legacy « Réfusé » : refusée", () => {
    expect(structureModeration({ statusActor: "Refusé" }, "statusActor")).toBe("refused");
    expect(structureModeration({ statusActor: "Réfusé" }, "statusActor")).toBe("refused");
  });

  it("« En attente », « En cours », absent ou inconnu : en attente — les listes publiques exigent « Validé »", () => {
    expect(structureModeration({ statusActor: "En attente" }, "statusActor")).toBe("pending");
    expect(structureModeration({ statusActor: "En cours" }, "statusActor")).toBe("pending");
    expect(structureModeration({}, "statusActor")).toBe("pending");
    expect(structureModeration({ statusActor: 42 }, "statusActor")).toBe("pending");
  });

  it("chemin pointé, et premier élément chaîne d'un tableau", () => {
    expect(structureModeration({ moderation: { etat: "Validé" } }, "moderation.etat")).toBeNull();
    expect(structureModeration({ statusActor: [1, "Refusé"] }, "statusActor")).toBe("refused");
  });
});

describe("slotsSummaryLabels — libellés du résumé d'un groupe", () => {
  const t = (key: string, _fallback?: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key);

  it("rien tant que la liste n'est pas chargée", () => {
    expect(slotsSummaryLabels(null, t)).toEqual([]);
  });

  it("aucun créneau, liste incomplète, puis compteurs dans l'ordre du résumé", () => {
    expect(slotsSummaryLabels({ kind: "none" }, t)).toEqual(["StructuresTab.summary.none"]);
    expect(slotsSummaryLabels({ kind: "partial", count: 50 }, t)).toEqual(['StructuresTab.summary.partial{"count":50}']);
    expect(
      slotsSummaryLabels({ kind: "counts", counts: [{ key: "pending", count: 2 }, { key: "validated", count: 1 }] }, t),
    ).toEqual(['StructuresTab.counts.pending{"count":2}', 'StructuresTab.counts.validated{"count":1}']);
  });
});
