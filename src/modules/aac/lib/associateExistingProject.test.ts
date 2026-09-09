import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Answer, Organization, Project } from "@communecter/cocolight-api-client";
import { associateExistingProject, ProjectAlreadyLinkedError } from "./associateExistingProject";

/**
 * Deux invariants comptent plus que la forme du payload :
 *  1. l'écriture `project` passe par `updateField` (le SEUL chemin possible —
 *     `project` est exclu de `Answer.save()`), jamais par une réécriture
 *     complète de la réponse ;
 *  2. le backfill dépense est DÉDUPLIQUÉ par `milestoneId` — rejouer
 *     l'association ne doit jamais dupliquer un palier déjà lié.
 */

function buildAnswer(existingDepenses: Array<Record<string, unknown>> = []) {
  return {
    id: "answer-1",
    serverData: { answers: { aapStep1: { depense: existingDepenses } } },
    updateField: vi.fn().mockResolvedValue(undefined),
    generateMilestoneFromDepense: vi.fn().mockResolvedValue({ milestoneId: "generated-milestone" }),
  } as unknown as Answer;
}

function buildProject(milestones: Array<Record<string, unknown>> = [], serverDataExtra: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    serverData: { oceco: { milestones }, ...serverDataExtra },
    updateField: vi.fn().mockResolvedValue(undefined),
  } as unknown as Project;
}

/**
 * Hôte de costum mocké, FIDÈLE au SDK : `coformAnswersSearch` passe par
 * `_createPaginatorEngine` → `_linkEntities`, qui élimine toute ligne sans
 * `collection` — donc TOUTE la page dès que la projection `fields` ne le
 * demande pas (piège vérifié, documenté dans `useReservationsQuery` et
 * `useInstallationAnswersQuery`). Le mock rejoue cette projection puis ce
 * filtre : un `fields` sans `"collection"` rend une page vide.
 */
function buildContext(resultIds: string[] = []) {
  return {
    coformAnswersSearch: vi.fn().mockImplementation(async (params: { fields?: string[] }) => {
      const fields = params.fields ?? [];
      const project = (row: Record<string, unknown>) =>
        Object.fromEntries(Object.entries(row).filter(([key]) => fields.length === 0 || fields.includes(key)));
      const results = resultIds
        .map((id) => project({ id, _id: { $id: id }, collection: "answers", project: { id: "proj-1" } }))
        .filter((row) => "collection" in row);
      return { results, count: { answers: results.length } };
    }),
  } as unknown as Organization;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("associateExistingProject — écriture du lien answer -> project", () => {
  it("écrit project = {id, startDate} via updateField, jamais via .save()", async () => {
    const answer = buildAnswer();
    const project = buildProject();

    await associateExistingProject({ answer, project, userId: "user-1" });

    expect(answer.updateField).toHaveBeenCalledWith(
      "project",
      expect.objectContaining({ id: "proj-1" }),
      {}
    );
  });

  it("lève une erreur si le projet n'a pas d'id", async () => {
    const answer = buildAnswer();
    const project = { id: "", serverData: { oceco: { milestones: [] } } } as unknown as Project;

    await expect(associateExistingProject({ answer, project, userId: "user-1" })).rejects.toThrow();
    expect(answer.updateField).not.toHaveBeenCalled();
  });

  it("pose le back-ref project.answer -> answer (miroir de answer.project)", async () => {
    const answer = buildAnswer();
    const project = buildProject();

    await associateExistingProject({ answer, project, userId: "user-1" });

    expect(project.updateField).toHaveBeenCalledWith("answer", "answer-1", {});
  });

  it("l'association réussit même si project.updateField('answer') rejette (best-effort)", async () => {
    const answer = buildAnswer();
    const project = buildProject();
    (project.updateField as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("403"));

    await expect(
      associateExistingProject({ answer, project, userId: "user-1" }),
    ).resolves.toBeDefined();
    expect(answer.updateField).toHaveBeenCalledWith("project", expect.objectContaining({ id: "proj-1" }), {});
  });
});

describe("associateExistingProject — double vérif « projet déjà rattaché à un autre commun »", () => {
  it("bloque si project.serverData.answer pointe un AUTRE commun (contrôle #1)", async () => {
    const answer = buildAnswer();
    const project = buildProject([], { answer: "answer-999" });

    await expect(
      associateExistingProject({ answer, project, userId: "user-1" }),
    ).rejects.toBeInstanceOf(ProjectAlreadyLinkedError);
    expect(answer.updateField).not.toHaveBeenCalled();
  });

  it("autorise si project.serverData.answer pointe DÉJÀ ce commun (ré-association idempotente)", async () => {
    const answer = buildAnswer();
    const project = buildProject([], { answer: "answer-1" });

    await expect(
      associateExistingProject({ answer, project, userId: "user-1" }),
    ).resolves.toBeDefined();
    expect(answer.updateField).toHaveBeenCalledWith("project", expect.objectContaining({ id: "proj-1" }), {});
  });

  it("bloque si la collection answers a un AUTRE commun sur project.id (contrôle #2)", async () => {
    const answer = buildAnswer();
    const project = buildProject();
    const context = buildContext(["answer-42"]);

    await expect(
      associateExistingProject({ answer, project, userId: "user-1", context }),
    ).rejects.toBeInstanceOf(ProjectAlreadyLinkedError);
    expect(context.coformAnswersSearch).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { "project.id": "proj-1" } }),
    );
    expect(answer.updateField).not.toHaveBeenCalled();
  });

  it("projette `collection` et `id` — sans eux, le SDK vide la page et le contrôle #2 est mort", () => {
    const context = buildContext(["answer-42"]);

    return associateExistingProject({ answer: buildAnswer(), project: buildProject(), userId: "user-1", context })
      .catch(() => undefined)
      .then(() => {
        expect(context.coformAnswersSearch).toHaveBeenCalledWith(
          expect.objectContaining({ fields: expect.arrayContaining(["collection", "id"]) }),
        );
      });
  });

  it("autorise si la collection answers ne renvoie que CE commun", async () => {
    const answer = buildAnswer();
    const project = buildProject();
    const context = buildContext(["answer-1"]);

    await expect(
      associateExistingProject({ answer, project, userId: "user-1", context }),
    ).resolves.toBeDefined();
    expect(answer.updateField).toHaveBeenCalled();
  });

  it("n'échoue PAS l'association si coformAnswersSearch throw (best-effort)", async () => {
    const answer = buildAnswer();
    const project = buildProject();
    const context = {
      coformAnswersSearch: vi.fn().mockRejectedValue(new Error("slug de l'entité non défini")),
    } as unknown as Organization;

    await expect(
      associateExistingProject({ answer, project, userId: "user-1", context }),
    ).resolves.toBeDefined();
    expect(answer.updateField).toHaveBeenCalled();
  });

  it("saute le contrôle #2 sans context", async () => {
    const answer = buildAnswer();
    const project = buildProject();

    await expect(associateExistingProject({ answer, project, userId: "user-1" })).resolves.toBeDefined();
  });
});

describe("associateExistingProject — backfill milestones -> dépenses", () => {
  it("crée une dépense (price: 0) pour chaque milestone du projet sans dépense correspondante", async () => {
    const answer = buildAnswer([]);
    const project = buildProject([
      { milestoneId: "m1", name: "Palier 1" },
      { milestoneId: "m2", name: "Palier 2" },
    ]);

    const result = await associateExistingProject({ answer, project, userId: "user-1" });

    expect(result).toEqual({ projectId: "proj-1", backfilledMilestonesCount: 2, repairedDepensesCount: 0 });
    // 1 appel pour l'écriture du lien project + 2 appels appendAnswerDepense
    // (chacun via answer.updateField("answers.aapStep1.depense", ..., {arrayForm:true,...})).
    const depenseCalls = (answer.updateField as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: unknown[]) => call[0] === "answers.aapStep1.depense"
    );
    expect(depenseCalls).toHaveLength(2);
    expect(depenseCalls[0][1]).toMatchObject({ poste: "Palier 1", price: 0, milestone: "m1", user: "user-1" });
    expect(depenseCalls[1][1]).toMatchObject({ poste: "Palier 2", price: 0, milestone: "m2", user: "user-1" });
  });

  it("ne recrée pas de dépense pour un milestone déjà lié (idempotent)", async () => {
    const answer = buildAnswer([{ milestone: "m1", price: 250 }]);
    const project = buildProject([
      { milestoneId: "m1", name: "Palier déjà lié" },
      { milestoneId: "m2", name: "Nouveau palier" },
    ]);

    const result = await associateExistingProject({ answer, project, userId: "user-1" });

    expect(result.backfilledMilestonesCount).toBe(1);
    const depenseCalls = (answer.updateField as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: unknown[]) => call[0] === "answers.aapStep1.depense"
    );
    expect(depenseCalls).toHaveLength(1);
    expect(depenseCalls[0][1]).toMatchObject({ milestone: "m2" });
  });

  it("ne crée aucune dépense si le projet n'a aucun milestone", async () => {
    const answer = buildAnswer([]);
    const project = buildProject([]);

    const result = await associateExistingProject({ answer, project, userId: "user-1" });

    expect(result.backfilledMilestonesCount).toBe(0);
    expect(answer.updateField).toHaveBeenCalledTimes(1); // uniquement l'écriture du lien project
  });
});

describe("associateExistingProject — réparation dépenses -> milestone (via l'endpoint backend)", () => {
  it("appelle generateMilestoneFromDepense pour chaque dépense sans milestone, au bon index", async () => {
    const answer = buildAnswer([{ poste: "Frais imprévus", price: 100 }, { poste: "Autre", price: 50 }]);
    const project = buildProject([]);

    const result = await associateExistingProject({ answer, project, userId: "user-1" });

    expect(result.repairedDepensesCount).toBe(2);
    expect(answer.generateMilestoneFromDepense).toHaveBeenNthCalledWith(1, "0");
    expect(answer.generateMilestoneFromDepense).toHaveBeenNthCalledWith(2, "1");
  });

  it("n'appelle pas generateMilestoneFromDepense pour une dépense déjà liée, même à un milestone orphelin", async () => {
    const answer = buildAnswer([{ poste: "Déjà lié", milestone: "id-etranger" }]);
    const project = buildProject([]);

    const result = await associateExistingProject({ answer, project, userId: "user-1" });

    expect(result.repairedDepensesCount).toBe(0);
    expect(answer.generateMilestoneFromDepense).not.toHaveBeenCalled();
  });

  it("propage l'erreur si generateMilestoneFromDepense échoue", async () => {
    const answer = buildAnswer([{ poste: "Frais imprévus" }]);
    (answer.generateMilestoneFromDepense as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    const project = buildProject([]);

    await expect(associateExistingProject({ answer, project, userId: "user-1" })).rejects.toThrow("boom");
  });
});

describe("associateExistingProject — pollution {} ↔ [] Mongo (régression)", () => {
  // `oceco.milestones`/`depense` peuvent arriver sérialisés en OBJET plutôt
  // qu'en tableau JS (clés PHP non séquentielles → json_encode produit `{}`,
  // pas `[]` — doc/34-module-aac.md, piège n°2). `toArray` traiterait alors
  // l'objet entier comme un unique élément sans `milestoneId`/`.milestone`,
  // que le code exclut silencieusement — c'est le bug corrigé ici.

  it("lit project.oceco.milestones même sérialisé en objet ({\"0\":..,\"1\":..})", async () => {
    const answer = buildAnswer([]);
    const project = {
      id: "proj-1",
      serverData: {
        oceco: {
          milestones: { 0: { milestoneId: "m1", name: "Palier 1" }, 2: { milestoneId: "m2", name: "Palier 2" } },
        },
      },
    } as unknown as Project;

    const result = await associateExistingProject({ answer, project, userId: "user-1" });

    expect(result.backfilledMilestonesCount).toBe(2);
    const depenseCalls = (answer.updateField as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: unknown[]) => call[0] === "answers.aapStep1.depense"
    );
    expect(depenseCalls).toHaveLength(2);
    expect(depenseCalls.map((call) => call[1] as Record<string, unknown>)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ milestone: "m1" }),
        expect.objectContaining({ milestone: "m2" }),
      ])
    );
  });

  it("lit answer.answers.<step>.depense même sérialisé en objet", async () => {
    const answer = {
      id: "answer-1",
      serverData: {
        answers: { aapStep1: { depense: { 0: { poste: "Frais imprévus" }, 3: { poste: "Autre" } } } },
      },
      updateField: vi.fn().mockResolvedValue(undefined),
      generateMilestoneFromDepense: vi.fn().mockResolvedValue({ milestoneId: "generated-milestone" }),
    } as unknown as Answer;
    const project = buildProject([]);

    const result = await associateExistingProject({ answer, project, userId: "user-1" });

    expect(result.repairedDepensesCount).toBe(2);
    expect(answer.generateMilestoneFromDepense).toHaveBeenCalledTimes(2);
  });
});
