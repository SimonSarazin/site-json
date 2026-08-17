import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Api } from "@communecter/cocolight-api-client";
import {
  updateAnswerDepenseFields,
  updateProjectMilestoneFields,
  deleteProjectMilestoneAtIndex,
  deleteAnswerDepenseAtIndex,
  deleteActionById,
} from "./actionMilestonePathUpdates";
import {
  closeMilestoneWithSync,
  deleteMilestoneWithSync,
  editMilestoneWithSync,
  getApiErrorMessage,
  restoreMilestoneWithSync,
} from "./milestoneMutationHandlers";

// Les primitives d'écriture (`entity.updateField(...)` sous le capot) sont
// mockées : ces tests couvrent l'orchestration/les contraintes de
// `milestoneMutationHandlers.ts`, pas `actionMilestonePathUpdates.ts` lui-même.
vi.mock("./actionMilestonePathUpdates", () => ({
  updateAnswerDepenseFields: vi.fn().mockResolvedValue(undefined),
  updateProjectMilestoneFields: vi.fn().mockResolvedValue(undefined),
  deleteProjectMilestoneAtIndex: vi.fn().mockResolvedValue(undefined),
  deleteAnswerDepenseAtIndex: vi.fn().mockResolvedValue(undefined),
  deleteActionById: vi.fn().mockResolvedValue(undefined),
  appendProjectMilestone: vi.fn().mockResolvedValue(undefined),
  appendAnswerDepense: vi.fn().mockResolvedValue(undefined),
}));

const mockUpdateAnswerDepenseFields = vi.mocked(updateAnswerDepenseFields);
const mockUpdateProjectMilestoneFields = vi.mocked(updateProjectMilestoneFields);
const mockDeleteProjectMilestoneAtIndex = vi.mocked(deleteProjectMilestoneAtIndex);
const mockDeleteAnswerDepenseAtIndex = vi.mocked(deleteAnswerDepenseAtIndex);
const mockDeleteActionById = vi.mocked(deleteActionById);

beforeEach(() => {
  vi.clearAllMocks();
});

/** Ligne `envelope.projects[]` — même forme que `useCagnotteAdapter`/`getEnvelopeProjects`. */
function buildRawEnvelope(projectData: Record<string, unknown>) {
  return { projects: [{ serverData: projectData }] };
}

/**
 * Construit une ligne `projectData` satisfaisant à la fois `getMilestoneConstraints`
 * (milestoneMutationHandlers.ts) et `resolveMilestoneSyncContext` (milestoneSyncContext.ts) :
 * `id`/`projectId` en champs directs (candidateAnswerId/candidateProjectId), `project.oceco.milestones`
 * côté projet, `depenses` côté answer.
 */
function buildProjectData(overrides: {
  answerId?: string;
  projectId?: string;
  milestoneId?: string;
  actions?: Array<Record<string, unknown>>;
  depenses?: Array<Record<string, unknown>>;
  omitProjectMilestone?: boolean;
  omitDepense?: boolean;
} = {}) {
  const answerId = overrides.answerId ?? "answer1";
  const projectId = overrides.projectId ?? "project1";
  const milestoneId = overrides.milestoneId ?? "m1";
  const actions = overrides.actions ?? [];
  const depenses =
    overrides.depenses ??
    (overrides.omitDepense ? [] : [{ milestone: milestoneId, priceInt: 100, financer: [] }]);

  return {
    id: answerId,
    projectId,
    project: {
      id: projectId,
      oceco: {
        milestones: overrides.omitProjectMilestone
          ? []
          : [{ milestoneId, name: "Palier test", description: "desc", status: "open" }],
      },
    },
    actions,
    depenses,
  };
}

function buildApiMock(params: { answerServerData?: Record<string, unknown> } = {}) {
  const answerServerData =
    params.answerServerData ?? { answers: { aapStep1: { depense: [{ price: 100 }] } } };
  const answerUpdateField = vi.fn().mockResolvedValue(undefined);
  const answerEntity = { serverData: answerServerData, updateField: answerUpdateField };

  const resolvedActionEntity = { id: "actionEntityStub" };
  const projectUpdateField = vi.fn().mockResolvedValue(undefined);
  const projectAction = vi.fn().mockResolvedValue(resolvedActionEntity);
  const projectEntity = { id: "project1", updateField: projectUpdateField, action: projectAction };

  const apiProject = vi.fn().mockResolvedValue(projectEntity);
  const apiAnswer = vi.fn().mockResolvedValue(answerEntity);

  return {
    api: { project: apiProject, answer: apiAnswer } as unknown as Api,
    answerEntity,
    answerUpdateField,
    projectEntity,
    projectAction,
    resolvedActionEntity,
    apiProject,
    apiAnswer,
  };
}

describe("getApiErrorMessage", () => {
  it("extrait response.data.message si présent", () => {
    const error = { response: { data: { message: "Erreur API précise" } } };
    expect(getApiErrorMessage(error, "fallback")).toBe("Erreur API précise");
  });

  it("extrait response.data.error si message absent", () => {
    const error = { response: { data: { error: "Erreur alternative" } } };
    expect(getApiErrorMessage(error, "fallback")).toBe("Erreur alternative");
  });

  it("retombe sur Error.message si pas de shape API reconnaissable", () => {
    expect(getApiErrorMessage(new Error("Erreur générique"), "fallback")).toBe("Erreur générique");
  });

  it("retombe sur le fallback si rien d'exploitable", () => {
    expect(getApiErrorMessage({}, "fallback")).toBe("fallback");
    expect(getApiErrorMessage(null, "fallback")).toBe("fallback");
  });
});

describe("contexte introuvable (syncContextMissing)", () => {
  it("lève une erreur si aucun projet de l'enveloppe ne correspond à answerId/projectId", async () => {
    const { api } = buildApiMock();
    const rawEnvelope = buildRawEnvelope(
      buildProjectData({ answerId: "otherAnswer", projectId: "otherProject" }),
    );

    await expect(
      editMilestoneWithSync({
        source: api,
        rawEnvelope,
        projectId: "project1",
        answerId: "answer1",
        milestoneId: "m1",
        name: "Nouveau nom",
        description: "desc",
        status: "open",
        targetAmount: 100,
      }),
    ).rejects.toThrow();
  });
});

describe("editMilestoneWithSync", () => {
  it("lève une erreur si la dépense côté answer est introuvable pour ce palier", async () => {
    const { api } = buildApiMock();
    // Le palier existe côté projet (oceco.milestones) mais aucune dépense ne le
    // référence côté answer -> answerDepenseIndex reste introuvable.
    const rawEnvelope = buildRawEnvelope(buildProjectData({ depenses: [{ milestone: "autre-palier", priceInt: 50 }] }));

    await expect(
      editMilestoneWithSync({
        source: api,
        rawEnvelope,
        projectId: "project1",
        answerId: "answer1",
        milestoneId: "m1",
        name: "Nouveau nom",
        description: "desc",
        status: "open",
        targetAmount: 100,
      }),
    ).rejects.toThrow();

    expect(mockUpdateAnswerDepenseFields).not.toHaveBeenCalled();
    expect(mockUpdateProjectMilestoneFields).not.toHaveBeenCalled();
  });

  it("écrit l'historique de prix uniquement si le prix change", async () => {
    const rawEnvelope = buildRawEnvelope(buildProjectData());

    // Cas A : même montant -> pas d'entrée d'historique.
    const unchanged = buildApiMock({
      answerServerData: { answers: { aapStep1: { depense: [{ price: 100 }] } } },
    });
    await editMilestoneWithSync({
      source: unchanged.api,
      rawEnvelope,
      projectId: "project1",
      answerId: "answer1",
      milestoneId: "m1",
      name: "Nom inchangé",
      description: "desc",
      status: "open",
      targetAmount: 100,
    });
    expect(unchanged.answerUpdateField).not.toHaveBeenCalled();
    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith(
      expect.objectContaining({ index: 0, fields: { poste: "Nom inchangé", price: 100 } }),
    );

    vi.clearAllMocks();

    // Cas B : montant modifié -> une entrée d'historique avant/après.
    const changed = buildApiMock({
      answerServerData: { answers: { aapStep1: { depense: [{ price: 100 }] } } },
    });
    await editMilestoneWithSync({
      source: changed.api,
      rawEnvelope,
      projectId: "project1",
      answerId: "answer1",
      milestoneId: "m1",
      name: "Nom modifié",
      description: "desc",
      status: "open",
      targetAmount: 150,
    });
    expect(changed.answerUpdateField).toHaveBeenCalledTimes(1);
    expect(changed.answerUpdateField).toHaveBeenCalledWith(
      "answers.aapStep1.depense.0.historique",
      expect.objectContaining({ champ: "price", avant: 100, apres: 150 }),
      expect.objectContaining({ arrayForm: true }),
    );
    expect(mockUpdateProjectMilestoneFields).toHaveBeenCalledWith(
      expect.objectContaining({ index: 0, fields: { name: "Nom modifié", description: "desc", status: "open" } }),
    );
  });
});

describe("closeMilestoneWithSync / restoreMilestoneWithSync", () => {
  const openParams = (rawEnvelope: unknown, api: Api) => ({
    source: api,
    rawEnvelope,
    projectId: "project1",
    answerId: "answer1",
    milestoneId: "m1",
  });

  it("lève cannotCloseWithOpenActions si une action du palier n'est pas terminée", async () => {
    const { api } = buildApiMock();
    const rawEnvelope = buildRawEnvelope(
      buildProjectData({ actions: [{ id: "a1", milestone: { milestoneId: "m1" }, status: "todo" }] }),
    );

    await expect(closeMilestoneWithSync(openParams(rawEnvelope, api))).rejects.toThrow();
    expect(mockUpdateProjectMilestoneFields).not.toHaveBeenCalled();
    expect(mockUpdateAnswerDepenseFields).not.toHaveBeenCalled();
  });

  it("clôture le palier si toutes ses actions sont terminées", async () => {
    const { api, answerEntity, projectEntity } = buildApiMock();
    const rawEnvelope = buildRawEnvelope(
      buildProjectData({ actions: [{ id: "a1", milestone: { milestoneId: "m1" }, status: "done" }] }),
    );

    await closeMilestoneWithSync(openParams(rawEnvelope, api));

    expect(mockUpdateProjectMilestoneFields).toHaveBeenCalledWith({
      project: projectEntity,
      index: 0,
      fields: { status: "close" },
    });
    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith({
      answer: answerEntity,
      index: 0,
      fields: { include: false },
    });
  });

  it("clôture le palier sans action associée (aucune action = pas de blocage)", async () => {
    const { api } = buildApiMock();
    const rawEnvelope = buildRawEnvelope(buildProjectData({ actions: [] }));

    await expect(closeMilestoneWithSync(openParams(rawEnvelope, api))).resolves.toBeUndefined();
    expect(mockUpdateProjectMilestoneFields).toHaveBeenCalledWith(
      expect.objectContaining({ fields: { status: "close" } }),
    );
  });

  it("restaure le palier (statut open, dépense réincluse)", async () => {
    const { api, answerEntity, projectEntity } = buildApiMock();
    const rawEnvelope = buildRawEnvelope(buildProjectData({ actions: [] }));

    await restoreMilestoneWithSync(openParams(rawEnvelope, api));

    expect(mockUpdateProjectMilestoneFields).toHaveBeenCalledWith({
      project: projectEntity,
      index: 0,
      fields: { status: "open" },
    });
    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith({
      answer: answerEntity,
      index: 0,
      fields: { include: true },
    });
  });
});

describe("deleteMilestoneWithSync", () => {
  it("lève cannotDeleteIfFunded si le palier a du financement", async () => {
    const { api } = buildApiMock();
    const rawEnvelope = buildRawEnvelope(
      buildProjectData({ depenses: [{ milestone: "m1", priceInt: 100, financer: [{ amount: 50 }] }] }),
    );

    await expect(
      deleteMilestoneWithSync({
        source: api,
        rawEnvelope,
        projectId: "project1",
        answerId: "answer1",
        milestoneId: "m1",
      }),
    ).rejects.toThrow();

    expect(mockDeleteProjectMilestoneAtIndex).not.toHaveBeenCalled();
    expect(mockDeleteAnswerDepenseAtIndex).not.toHaveBeenCalled();
  });

  it("supprime le palier et les actions liées si non financé", async () => {
    const { api, answerEntity, projectEntity, projectAction, resolvedActionEntity } = buildApiMock();
    const rawEnvelope = buildRawEnvelope(
      buildProjectData({
        depenses: [{ milestone: "m1", priceInt: 100, financer: [] }],
        actions: [{ id: "a1", milestone: { milestoneId: "m1" }, status: "done" }],
      }),
    );

    await deleteMilestoneWithSync({
      source: api,
      rawEnvelope,
      projectId: "project1",
      answerId: "answer1",
      milestoneId: "m1",
    });

    expect(projectAction).toHaveBeenCalledWith({ id: "a1" });
    expect(mockDeleteActionById).toHaveBeenCalledWith({ action: resolvedActionEntity });
    expect(mockDeleteProjectMilestoneAtIndex).toHaveBeenCalledWith({ project: projectEntity, index: 0 });
    expect(mockDeleteAnswerDepenseAtIndex).toHaveBeenCalledWith({ answer: answerEntity, index: 0 });
  });
});
