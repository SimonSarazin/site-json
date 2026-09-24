import { describe, it, expect, vi } from "vitest";
import { applyCommunDeletion } from "./useDeleteCommun";
import type { AnswerDeletionEndpoint } from "@/modules/coform/actions/mutations/answer";

/**
 * Une cascade de suppressions est le genre de séquence où l'ORDRE et les échecs
 * partiels décident de l'état final. On vérifie donc les deux : ce qui part, et
 * dans quel ordre — y compris quand une étape lâche en cours de route.
 */

function endpoint(echoueSur: (type: string, id: string) => boolean = () => false) {
  const appels: string[] = [];
  const api: AnswerDeletionEndpoint = {
    deleteElement: vi.fn(async ({ pathParams }) => {
      appels.push(`${pathParams.type}:${pathParams.id}`);
      if (echoueSur(pathParams.type, pathParams.id)) throw new Error("403");
      return { result: true };
    }),
  };
  return { api, appels };
}

describe("applyCommunDeletion", () => {
  it("sans cascade, ne supprime QUE le commun", async () => {
    const { api, appels } = endpoint();
    const outcome = await applyCommunDeletion(api, { answerId: "a1" });

    expect(appels).toEqual(["answers:a1"]);
    expect(outcome).toEqual({
      actionsDeleted: 0,
      actionsFailed: 0,
      projectDeleted: false,
      projectFailed: false,
    });
  });

  it("ignore projet et actions tant que la cascade n'est pas demandée", async () => {
    const { api, appels } = endpoint();
    await applyCommunDeletion(api, {
      answerId: "a1",
      projectId: "p1",
      actionIds: ["act-1"],
      withProject: false,
    });
    expect(appels).toEqual(["answers:a1"]);
  });

  /**
   * Les actions AVANT le projet : une fois le projet parti, plus rien ne permet
   * de les retrouver pour les nettoyer. Et le commun en tout premier, parce que
   * c'est la demande — son échec doit faire échouer le geste entier.
   */
  it("supprime dans l'ordre : commun, puis actions, puis projet", async () => {
    const { api, appels } = endpoint();
    const outcome = await applyCommunDeletion(api, {
      answerId: "a1",
      withProject: true,
      projectId: "p1",
      actionIds: ["act-1", "act-2"],
    });

    expect(appels).toEqual(["answers:a1", "actions:act-1", "actions:act-2", "projects:p1"]);
    expect(outcome).toEqual({
      actionsDeleted: 2,
      actionsFailed: 0,
      projectDeleted: true,
      projectFailed: false,
    });
  });

  /** L'échec du commun est le seul qui doit interrompre : rien d'autre ne part. */
  it("un commun qui refuse de partir arrête tout", async () => {
    const { api, appels } = endpoint((type) => type === "answers");
    await expect(
      applyCommunDeletion(api, {
        answerId: "a1",
        withProject: true,
        projectId: "p1",
        actionIds: ["act-1"],
      })
    ).rejects.toThrow("403");

    expect(appels).toEqual(["answers:a1"]);
  });

  /**
   * Le nettoyage est BEST-EFFORT : une action récalcitrante ne doit pas laisser
   * les suivantes ni le projet en place, ni faire croire à un échec global.
   */
  it("poursuit le nettoyage malgré une action en échec, et le compte", async () => {
    const { api, appels } = endpoint((type, id) => type === "actions" && id === "act-2");
    const outcome = await applyCommunDeletion(api, {
      answerId: "a1",
      withProject: true,
      projectId: "p1",
      actionIds: ["act-1", "act-2", "act-3"],
    });

    expect(appels).toEqual([
      "answers:a1",
      "actions:act-1",
      "actions:act-2",
      "actions:act-3",
      "projects:p1",
    ]);
    expect(outcome.actionsDeleted).toBe(2);
    expect(outcome.actionsFailed).toBe(1);
    expect(outcome.projectDeleted).toBe(true);
  });

  it("rapporte un projet qui n'a pas pu être supprimé, sans lever", async () => {
    const { api } = endpoint((type) => type === "projects");
    const outcome = await applyCommunDeletion(api, {
      answerId: "a1",
      withProject: true,
      projectId: "p1",
      actionIds: [],
    });

    expect(outcome.projectDeleted).toBe(false);
    expect(outcome.projectFailed).toBe(true);
  });

  it("une cascade demandée sans projet supprime quand même les actions", async () => {
    const { api, appels } = endpoint();
    const outcome = await applyCommunDeletion(api, {
      answerId: "a1",
      withProject: true,
      projectId: null,
      actionIds: ["act-1"],
    });

    expect(appels).toEqual(["answers:a1", "actions:act-1"]);
    expect(outcome.actionsDeleted).toBe(1);
    expect(outcome.projectDeleted).toBe(false);
    expect(outcome.projectFailed).toBe(false);
  });
});
