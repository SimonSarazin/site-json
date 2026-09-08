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
      expect.objectContaining({ index: 0, fields: { poste: "Nom inchangé", price: 100, description: "desc" } }),
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

/**
 * Le repli `docs` (commun déposé sous un autre contexte) voit les deux documents du
 * palier, mais PAS ses actions — elles ne vivent ni dans `oceco.milestones[]` ni dans
 * `depense[]`, et le SDK n'expose aucun listage hors enveloppe.
 *
 * Édition et clôture s'en accommodent ; la suppression non : elle DOIT supprimer les
 * actions liées, et une liste vide qu'on ne sait pas distinguer de « aucune action »
 * les laisserait orphelines.
 */
describe("deleteMilestoneWithSync — repli sur les documents", () => {
  const DOCS = {
    projectMilestones: [{ milestoneId: "m1", name: "Palier test", description: "desc", status: "open" }],
    depenses: [{ milestone: "m1", priceInt: 100, financer: [] }],
  };

  it("refuse de supprimer sans enveloppe : les actions liées y seraient invisibles", async () => {
    const { api } = buildApiMock();

    await expect(
      deleteMilestoneWithSync({
        source: api,
        rawEnvelope: { projects: [] },
        docs: DOCS,
        projectId: "project1",
        answerId: "answer1",
        milestoneId: "m1",
      }),
      // Le motif compte : ce refus-ci, pas celui d'un palier financé.
    ).rejects.toThrow("milestone.errors.cannotDeleteWithoutEnvelope");

    expect(mockDeleteActionById).not.toHaveBeenCalled();
    expect(mockDeleteProjectMilestoneAtIndex).not.toHaveBeenCalled();
    expect(mockDeleteAnswerDepenseAtIndex).not.toHaveBeenCalled();
  });

  it("garde `hasFunding` exact : un palier financé est refusé pour SA raison", async () => {
    const { api } = buildApiMock();

    await expect(
      deleteMilestoneWithSync({
        source: api,
        rawEnvelope: { projects: [] },
        docs: { ...DOCS, depenses: [{ milestone: "m1", priceInt: 100, financer: [{ amount: 50 }] }] },
        projectId: "project1",
        answerId: "answer1",
        milestoneId: "m1",
      }),
    ).rejects.toThrow("milestone.errors.cannotDeleteIfFunded");

    expect(mockDeleteProjectMilestoneAtIndex).not.toHaveBeenCalled();
  });

  it("clôture TOUJOURS permise en repli — compromis assumé, faute de voir les actions", async () => {
    const { api, answerEntity, projectEntity } = buildApiMock();

    await closeMilestoneWithSync({
      source: api,
      rawEnvelope: { projects: [] },
      docs: DOCS,
      projectId: "project1",
      answerId: "answer1",
      milestoneId: "m1",
    });

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
});

/**
 * Palier « answer-only » : la dépense ne référence aucun palier projet (`milestoneId`
 * vide). C'est le cas d'un commun AAC SANS projet lié — `buildItemsFromRawDepenses`
 * produit `{ milestoneId: "", depenseIndex }`, et `MilestoneEditDialog` accepte ce
 * cas dès qu'un `answerDepenseIndex` est fourni. Les quatre handlers doivent alors
 * cibler CET index côté réponse, et ne rien tenter côté projet.
 *
 * Non-régression MR 53 (review §1.4) : les résolveurs rendent `null` sur id vide, et
 * `resolveSyncContextOrThrow` levait `syncContextMissing` AVANT de lire
 * `answerDepenseIndex` — les quatre boutons de la fiche commun étaient morts.
 */
describe("palier answer-only (milestoneId vide + answerDepenseIndex)", () => {
  const RAW_DEPENSES = [{ poste: "A", price: 10 }, { poste: "B", price: 20 }];
  const answerServerData = { answers: { aapStep1: { depense: RAW_DEPENSES } } };

  /** Même forme que `useCommunObjectivesController` sans projet : `projectMilestones` absent. */
  const answerOnly = {
    rawEnvelope: null as unknown,
    docs: { projectMilestones: undefined, depenses: RAW_DEPENSES },
    projectId: "",
    answerId: "answer1",
    milestoneId: "",
    answerDepenseIndex: 1,
  };

  it("edit écrit poste/prix à l'index fourni, sans rien tenter côté projet", async () => {
    const { api, answerEntity, answerUpdateField, apiProject } = buildApiMock({ answerServerData });

    await editMilestoneWithSync({
      source: api,
      ...answerOnly,
      name: "B2",
      description: "",
      status: "open",
      targetAmount: 30,
    });

    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: answerEntity,
        index: 1,
        fields: expect.objectContaining({ poste: "B2", price: 30 }),
      }),
    );
    // Historique de prix : 20 → 30, à l'index 1.
    expect(answerUpdateField).toHaveBeenCalledWith(
      "answers.aapStep1.depense.1.historique",
      expect.objectContaining({ champ: "price", avant: 20, apres: 30 }),
      expect.objectContaining({ arrayForm: true }),
    );
    expect(apiProject).not.toHaveBeenCalled();
    expect(mockUpdateProjectMilestoneFields).not.toHaveBeenCalled();
  });

  it("close passe la dépense à include:false à l'index fourni, sans rien tenter côté projet", async () => {
    const { api, answerEntity, apiProject } = buildApiMock({ answerServerData });

    await closeMilestoneWithSync({ source: api, ...answerOnly });

    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith({
      answer: answerEntity,
      index: 1,
      fields: { include: false },
    });
    expect(apiProject).not.toHaveBeenCalled();
    expect(mockUpdateProjectMilestoneFields).not.toHaveBeenCalled();
  });

  it("restore repasse la dépense à include:true à l'index fourni, sans rien tenter côté projet", async () => {
    const { api, answerEntity, apiProject } = buildApiMock({ answerServerData });

    await restoreMilestoneWithSync({ source: api, ...answerOnly });

    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith({
      answer: answerEntity,
      index: 1,
      fields: { include: true },
    });
    expect(apiProject).not.toHaveBeenCalled();
    expect(mockUpdateProjectMilestoneFields).not.toHaveBeenCalled();
  });

  it("delete retire la dépense à l'index fourni, sans rien tenter côté projet", async () => {
    const { api, answerEntity, apiProject } = buildApiMock({ answerServerData });

    await deleteMilestoneWithSync({ source: api, ...answerOnly });

    expect(mockDeleteAnswerDepenseAtIndex).toHaveBeenCalledWith({ answer: answerEntity, index: 1 });
    expect(apiProject).not.toHaveBeenCalled();
    expect(mockDeleteActionById).not.toHaveBeenCalled();
    expect(mockDeleteProjectMilestoneAtIndex).not.toHaveBeenCalled();
  });

  it("delete refuse toujours une dépense financée — `hasFunding` est lu à l'index fourni", async () => {
    const { api } = buildApiMock({ answerServerData });

    await expect(
      deleteMilestoneWithSync({
        source: api,
        ...answerOnly,
        docs: { projectMilestones: undefined, depenses: [RAW_DEPENSES[0], { ...RAW_DEPENSES[1], financer: [{ amount: 5 }] }] },
      }),
    ).rejects.toThrow("milestone.errors.cannotDeleteIfFunded");

    expect(mockDeleteAnswerDepenseAtIndex).not.toHaveBeenCalled();
  });

  it("GARDE : un milestoneId vide SANS index reste refusé (syncContextMissing), sans écriture", async () => {
    const { api, apiAnswer } = buildApiMock({ answerServerData });
    const { answerDepenseIndex: _omitted, ...withoutIndex } = answerOnly;

    await expect(
      editMilestoneWithSync({ source: api, ...withoutIndex, name: "B2", description: "", status: "open", targetAmount: 30 }),
    ).rejects.toThrow("milestone.errors.syncContextMissing");

    expect(apiAnswer).not.toHaveBeenCalled();
    expect(mockUpdateAnswerDepenseFields).not.toHaveBeenCalled();
  });

  it("TÉMOIN : un milestoneId renseigné (dépense liée) passe par le résolveur et écrit à l'index apparié", async () => {
    const { api } = buildApiMock({ answerServerData });
    const linked = [RAW_DEPENSES[0], { ...RAW_DEPENSES[1], milestone: "m1" }];

    await editMilestoneWithSync({
      source: api,
      rawEnvelope: null,
      docs: { projectMilestones: undefined, depenses: linked },
      projectId: "",
      answerId: "answer1",
      milestoneId: "m1",
      name: "B2",
      description: "",
      status: "open",
      targetAmount: 30,
    });

    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith(
      expect.objectContaining({ index: 1, fields: expect.objectContaining({ poste: "B2", price: 30 }) }),
    );
    expect(mockUpdateProjectMilestoneFields).not.toHaveBeenCalled();
  });
});

/**
 * B3 (review MR 53, relecture) : commun AVEC projet lié, dépense legacy sans
 * `milestone`. La réparation de `useCagnotteAdapter` écrit l'id fabriqué sur le
 * projet ET sur `depense[i].milestone`, mais l'écran peut encore tenir l'item
 * d'AVANT (`{ milestoneId: "", depenseIndex: i }`, repris de la ligne brute par
 * `buildItemsFromRawDepenses`). Conclure « answer-only » avec un projet lié
 * échouait en `missingProjectSide` : les quatre handlers relisent l'id que porte la
 * dépense visée — dans l'enveloppe, puis dans `docs` — et traitent le palier des
 * deux côtés.
 */
describe("milestoneId vide + index, AVEC projet lié : l'id est relu sur la dépense visée", () => {
  const RECOVERED = "m-repare";
  const DEPENSES = [{ poste: "A", price: 10 }, { poste: "B", price: 20, milestone: RECOVERED }];
  /** Le palier relu est en 2ᵉ position côté projet : l'index projet (1) doit venir de LUI, pas de la dépense. */
  const PROJECT_MILESTONES = [
    { milestoneId: "m1", name: "Autre", description: "", status: "open" },
    { milestoneId: RECOVERED, name: "B", description: "", status: "open" },
  ];
  const answerServerData = { answers: { aapStep1: { depense: DEPENSES } } };
  const DOCS = { projectMilestones: PROJECT_MILESTONES, depenses: DEPENSES };
  const base = { projectId: "project1", answerId: "answer1", milestoneId: "", answerDepenseIndex: 1 };

  const envelopeWith = (
    extra: { actions?: Array<Record<string, unknown>>; depenses?: Array<Record<string, unknown>> } = {},
  ) =>
    buildRawEnvelope({
      id: "answer1",
      projectId: "project1",
      project: { id: "project1", oceco: { milestones: PROJECT_MILESTONES } },
      actions: extra.actions ?? [],
      depenses: extra.depenses ?? DEPENSES,
    });

  it("edit (docs seuls) : écrit les DEUX côtés, à l'index projet du palier relu", async () => {
    const { api, answerEntity, projectEntity } = buildApiMock({ answerServerData });

    await editMilestoneWithSync({
      source: api,
      rawEnvelope: null,
      docs: DOCS,
      ...base,
      name: "B2",
      description: "d",
      status: "open",
      targetAmount: 20,
    });

    expect(mockUpdateProjectMilestoneFields).toHaveBeenCalledWith({
      project: projectEntity,
      index: 1,
      fields: { name: "B2", description: "d", status: "open" },
    });
    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: answerEntity,
        index: 1,
        fields: expect.objectContaining({ poste: "B2", price: 20 }),
      }),
    );
  });

  it("close (enveloppe seule) : idem depuis la ligne de la ressource, sans docs", async () => {
    const { api, answerEntity, projectEntity } = buildApiMock({ answerServerData });

    await closeMilestoneWithSync({ source: api, rawEnvelope: envelopeWith(), ...base });

    expect(mockUpdateProjectMilestoneFields).toHaveBeenCalledWith({
      project: projectEntity,
      index: 1,
      fields: { status: "close" },
    });
    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith({
      answer: answerEntity,
      index: 1,
      fields: { include: false },
    });
  });

  it("restore (enveloppe seule) : rouvre le palier relu des deux côtés", async () => {
    const { api, answerEntity, projectEntity } = buildApiMock({ answerServerData });

    await restoreMilestoneWithSync({ source: api, rawEnvelope: envelopeWith(), ...base });

    expect(mockUpdateProjectMilestoneFields).toHaveBeenCalledWith({
      project: projectEntity,
      index: 1,
      fields: { status: "open" },
    });
    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith({
      answer: answerEntity,
      index: 1,
      fields: { include: true },
    });
  });

  it("les contraintes voient l'id relu : close refuse une action ouverte sur CE palier", async () => {
    const { api } = buildApiMock({ answerServerData });
    const rawEnvelope = envelopeWith({ actions: [{ id: "a1", milestone: { milestoneId: RECOVERED }, status: "todo" }] });

    await expect(closeMilestoneWithSync({ source: api, rawEnvelope, ...base })).rejects.toThrow(
      "milestone.errors.cannotCloseWithOpenActions",
    );
    expect(mockUpdateProjectMilestoneFields).not.toHaveBeenCalled();
    expect(mockUpdateAnswerDepenseFields).not.toHaveBeenCalled();
  });

  it("delete (enveloppe) : supprime l'action liée au palier relu, le palier projet et la dépense", async () => {
    const { api, answerEntity, projectEntity, projectAction, resolvedActionEntity } = buildApiMock({ answerServerData });
    const rawEnvelope = envelopeWith({ actions: [{ id: "a1", milestone: { milestoneId: RECOVERED }, status: "done" }] });

    await deleteMilestoneWithSync({ source: api, rawEnvelope, ...base });

    expect(projectAction).toHaveBeenCalledWith({ id: "a1" });
    expect(mockDeleteActionById).toHaveBeenCalledWith({ action: resolvedActionEntity });
    expect(mockDeleteProjectMilestoneAtIndex).toHaveBeenCalledWith({ project: projectEntity, index: 1 });
    expect(mockDeleteAnswerDepenseAtIndex).toHaveBeenCalledWith({ answer: answerEntity, index: 1 });
  });

  it("l'enveloppe prime sur des docs périmés : la dépense sans `milestone` dans docs est relue dans l'enveloppe", async () => {
    const { api, projectEntity } = buildApiMock({ answerServerData });
    // `docs.depenses` partage le cache de l'écran (`useCommunRawDepenses`) : c'est
    // lui qui peut être en retard sur la réparation, pas l'enveloppe.
    const staleDocs = {
      projectMilestones: PROJECT_MILESTONES,
      depenses: [{ poste: "A", price: 10 }, { poste: "B", price: 20 }],
    };

    await editMilestoneWithSync({
      source: api,
      rawEnvelope: envelopeWith(),
      docs: staleDocs,
      ...base,
      name: "B2",
      description: "d",
      status: "open",
      targetAmount: 20,
    });

    expect(mockUpdateProjectMilestoneFields).toHaveBeenCalledWith(
      expect.objectContaining({ project: projectEntity, index: 1 }),
    );
    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith(expect.objectContaining({ index: 1 }));
  });

  it("GARDE : sans projet lié, pas de relecture — l'index seul fait foi (answer-only)", async () => {
    const { api, apiProject } = buildApiMock({ answerServerData });

    await closeMilestoneWithSync({ source: api, rawEnvelope: null, docs: DOCS, ...base, projectId: "" });

    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith(
      expect.objectContaining({ index: 1, fields: { include: false } }),
    );
    expect(apiProject).not.toHaveBeenCalled();
    expect(mockUpdateProjectMilestoneFields).not.toHaveBeenCalled();
  });

  it("GARDE : dépense sans `milestone` nulle part → reste answer-only, et le côté projet manque vraiment", async () => {
    const { api } = buildApiMock({ answerServerData });
    const sansId = {
      projectMilestones: PROJECT_MILESTONES,
      depenses: [{ poste: "A", price: 10 }, { poste: "B", price: 20 }],
    };

    await expect(
      editMilestoneWithSync({
        source: api,
        rawEnvelope: null,
        docs: sansId,
        ...base,
        name: "B2",
        description: "d",
        status: "open",
        targetAmount: 20,
      }),
    ).rejects.toThrow("milestone.errors.incompleteForEdit.missingProjectSide");
    expect(mockUpdateAnswerDepenseFields).not.toHaveBeenCalled();
    expect(mockUpdateProjectMilestoneFields).not.toHaveBeenCalled();
  });
});

/**
 * H22 (review MR 53) : `description` n'était envoyée QUE par
 * `updateProjectMilestoneFields`. Sans projet lié, donc jamais — le formulaire la
 * jetait en silence, avec un toast « mis à jour ». Le premier correctif ne
 * l'écrivait sur la dépense QUE sans projet ; or la fiche et la modale relisent
 * `depense.description` quel que soit le projet (`useCagnotteAdapter`,
 * `buildItemsFromRawDepenses`, `fundableItemToMilestone`) : avec projet, la
 * description éditée restait invisible. Elle est écrite sur la dépense SANS
 * condition, et sur `oceco.milestones[]` en plus quand un projet est lié.
 */
describe("editMilestoneWithSync — description écrite sur la dépense (H22)", () => {
  it("écrit la description saisie sur la dépense de la réponse quand projectId est vide", async () => {
    const { api, answerEntity, apiProject } = buildApiMock({
      answerServerData: { answers: { aapStep1: { depense: [{ poste: "A", price: 10 }, { poste: "B", price: 20, milestone: "m1" }] } } },
    });

    await editMilestoneWithSync({
      source: api,
      rawEnvelope: null,
      docs: { projectMilestones: undefined, depenses: [{ poste: "A", price: 10 }, { poste: "B", price: 20, milestone: "m1" }] },
      projectId: "",
      answerId: "answer1",
      milestoneId: "m1",
      name: "B",
      description: "Description saisie",
      status: "open",
      targetAmount: 20,
    });

    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith({
      answer: answerEntity,
      index: 1,
      fields: { poste: "B", price: 20, description: "Description saisie" },
    });
    expect(apiProject).not.toHaveBeenCalled();
    expect(mockUpdateProjectMilestoneFields).not.toHaveBeenCalled();
  });

  it("écrit aussi la description sur un palier answer-only (milestoneId vide + index)", async () => {
    const { api, answerEntity } = buildApiMock({
      answerServerData: { answers: { aapStep1: { depense: [{ poste: "A", price: 10 }, { poste: "B", price: 20 }] } } },
    });

    await editMilestoneWithSync({
      source: api,
      rawEnvelope: null,
      docs: { projectMilestones: undefined, depenses: [{ poste: "A", price: 10 }, { poste: "B", price: 20 }] },
      projectId: "",
      answerId: "answer1",
      milestoneId: "",
      answerDepenseIndex: 1,
      name: "B",
      description: "Description saisie",
      status: "open",
      targetAmount: 20,
    });

    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith({
      answer: answerEntity,
      index: 1,
      fields: { poste: "B", price: 20, description: "Description saisie" },
    });
  });

  it("avec projet lié, la description est écrite des DEUX côtés — la dépense est ce que l'écran relit", async () => {
    const { api, answerEntity, projectEntity } = buildApiMock();
    const rawEnvelope = buildRawEnvelope(buildProjectData());

    await editMilestoneWithSync({
      source: api,
      rawEnvelope,
      projectId: "project1",
      answerId: "answer1",
      milestoneId: "m1",
      name: "Palier",
      description: "Description saisie",
      status: "open",
      targetAmount: 100,
    });

    expect(mockUpdateAnswerDepenseFields).toHaveBeenCalledWith({
      answer: answerEntity,
      index: 0,
      fields: { poste: "Palier", price: 100, description: "Description saisie" },
    });
    expect(mockUpdateProjectMilestoneFields).toHaveBeenCalledWith({
      project: projectEntity,
      index: 0,
      fields: { name: "Palier", description: "Description saisie", status: "open" },
    });
  });
});
