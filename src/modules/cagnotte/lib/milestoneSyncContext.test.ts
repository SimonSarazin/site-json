import { describe, expect, it } from "vitest";
import {
  resolveMilestoneSyncContext,
  resolveMilestoneSyncContextFromDocs,
} from "./milestoneSyncContext";

/**
 * Où vit un palier dans les deux documents qui le portent.
 *
 * Le repli `docs` existe pour les ressources ABSENTES de l'enveloppe interrogée
 * (commun déposé sous un autre contexte) : sans lui, éditer / clôturer / supprimer
 * un palier échouait sur `milestone.errors.syncContextMissing`.
 */

const PROJECT_MILESTONES = [
  { milestoneId: "m0", description: "Zéro" },
  { milestoneId: "m1", description: "Un" },
];
const DEPENSES = [{ milestone: "m1", poste: "Palier un" }, { milestone: "m2", poste: "Palier deux" }];

describe("resolveMilestoneSyncContextFromDocs", () => {
  it("trouve les deux index quand le palier existe des deux côtés", () => {
    expect(
      resolveMilestoneSyncContextFromDocs({
        projectMilestones: PROJECT_MILESTONES,
        depenses: DEPENSES,
        milestoneId: "m1",
      }),
    ).toEqual({ projectMilestoneIndex: 1, answerDepenseIndex: 0, description: "Un", fromDocs: true });
  });

  it("tolère un palier connu du seul projet", () => {
    expect(
      resolveMilestoneSyncContextFromDocs({
        projectMilestones: PROJECT_MILESTONES,
        depenses: [],
        milestoneId: "m0",
      }),
    ).toEqual({ projectMilestoneIndex: 0, answerDepenseIndex: null, description: "Zéro", fromDocs: true });
  });

  it("tolère une dépense sans jalon projet", () => {
    expect(
      resolveMilestoneSyncContextFromDocs({
        projectMilestones: [],
        depenses: DEPENSES,
        milestoneId: "m2",
      }),
    ).toEqual({ projectMilestoneIndex: null, answerDepenseIndex: 1, description: "", fromDocs: true });
  });

  it("retourne null quand le palier n'existe nulle part", () => {
    expect(
      resolveMilestoneSyncContextFromDocs({
        projectMilestones: PROJECT_MILESTONES,
        depenses: DEPENSES,
        milestoneId: "inconnu",
      }),
    ).toBeNull();
  });
});

describe("resolveMilestoneSyncContext — repli sur les documents", () => {
  const envelopeWithAnswer = {
    projects: [
      {
        id: "answer-1",
        project: { id: "proj-1", oceco: { milestones: PROJECT_MILESTONES } },
        depenses: DEPENSES,
      },
    ],
  };

  it("lit l'enveloppe quand elle porte la ressource", () => {
    expect(
      resolveMilestoneSyncContext({
        rawEnvelope: envelopeWithAnswer,
        projectId: "proj-1",
        answerId: "answer-1",
        milestoneId: "m1",
      }),
    ).toEqual({ projectMilestoneIndex: 1, answerDepenseIndex: 0, description: "Un", fromDocs: false });
  });

  it("retombe sur les documents quand l'enveloppe ignore la ressource", () => {
    expect(
      resolveMilestoneSyncContext({
        rawEnvelope: { projects: [] },
        docs: { projectMilestones: PROJECT_MILESTONES, depenses: DEPENSES },
        projectId: "proj-1",
        answerId: "answer-etranger",
        milestoneId: "m1",
      }),
    ).toEqual({ projectMilestoneIndex: 1, answerDepenseIndex: 0, description: "Un", fromDocs: true });
  });

  it("retourne null sans enveloppe ni documents — comportement d'avant", () => {
    expect(
      resolveMilestoneSyncContext({
        rawEnvelope: { projects: [] },
        projectId: "proj-1",
        answerId: "answer-1",
        milestoneId: "m1",
      }),
    ).toBeNull();
  });
});

describe("resolveMilestoneSyncContext — le repli refuse ce qui n'est pas un vrai tableau", () => {
  /**
   * Les index rendus deviennent des chemins Mongo littéraux
   * (`answers.<step>.depense.<i>`). Un `depense` sérialisé en objet (pollution Mongo
   * `{}` ↔ `[]`) redensé par `Object.values` donnerait un index qui ne correspond plus
   * à la clé du document : l'écriture toucherait la MAUVAISE dépense. Mieux vaut un
   * `syncContextMissing` explicite.
   */
  it("ignore un depense sérialisé en objet plutôt que d'en dériver un index", () => {
    expect(
      resolveMilestoneSyncContext({
        rawEnvelope: { projects: [] },
        docs: {
          projectMilestones: PROJECT_MILESTONES,
          // Clés NON contiguës : Object.values donnerait l'index 0 pour la clé "3".
          depenses: { "3": { milestone: "m1", poste: "Palier un" } },
        },
        projectId: "proj-1",
        answerId: "answer-etranger",
        milestoneId: "m1",
      }),
    ).toEqual({ projectMilestoneIndex: 1, answerDepenseIndex: null, description: "Un", fromDocs: true });
  });

  it("ignore des milestones sérialisés en objet", () => {
    expect(
      resolveMilestoneSyncContext({
        rawEnvelope: { projects: [] },
        docs: {
          projectMilestones: { "2": { milestoneId: "m1", description: "Un" } },
          depenses: DEPENSES,
        },
        projectId: "proj-1",
        answerId: "answer-etranger",
        milestoneId: "m1",
      }),
    ).toEqual({ projectMilestoneIndex: null, answerDepenseIndex: 0, description: "", fromDocs: true });
  });

  it("rend null quand les DEUX documents sont inexploitables", () => {
    expect(
      resolveMilestoneSyncContext({
        rawEnvelope: { projects: [] },
        docs: { projectMilestones: { a: {} }, depenses: { b: {} } },
        projectId: "proj-1",
        answerId: "answer-etranger",
        milestoneId: "m1",
      }),
    ).toBeNull();
  });
});
