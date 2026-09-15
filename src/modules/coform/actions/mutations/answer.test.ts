import { describe, it, expect, vi } from "vitest";
import { deleteElementById, type AnswerDeletionEndpoint } from "./answer";

/**
 * La suppression est IRRÉVERSIBLE et contourne les gardes du SDK : on verrouille ici la forme
 * EXACTE de l'appel, dont la dérive supprimerait autre chose que ce qu'on croit.
 */

function cible() {
  const appels: { reason: string; pathParams: { type: string; id: string } }[] = [];
  const endpointApi: AnswerDeletionEndpoint = {
    deleteElement: vi.fn(async (data) => {
      appels.push(data);
      return { result: true };
    }),
  };
  return { endpointApi, appels };
}

describe("deleteElementById", () => {
  it("vise la collection et l'id donnés, avec la raison d'audit", async () => {
    const { endpointApi, appels } = cible();
    await deleteElementById(endpointApi, "answers", "answer-1", "delete commun AAC");

    expect(endpointApi.deleteElement).toHaveBeenCalledTimes(1);
    expect(appels[0]).toEqual({
      reason: "delete commun AAC",
      pathParams: { type: "answers", id: "answer-1" },
    });
  });

  /** La cascade d'un commun supprime trois collections par le MÊME chemin (§`useDeleteCommun`). */
  it("adresse les autres collections à l'identique", async () => {
    const { endpointApi, appels } = cible();
    await deleteElementById(endpointApi, "actions", "act-1", "r");
    await deleteElementById(endpointApi, "projects", "proj-1", "r");

    expect(appels.map((a) => a.pathParams)).toEqual([
      { type: "actions", id: "act-1" },
      { type: "projects", id: "proj-1" },
    ]);
  });

  it("laisse remonter l'échec — rien ne doit masquer un refus du serveur", async () => {
    const endpointApi: AnswerDeletionEndpoint = {
      deleteElement: vi.fn(async () => {
        throw new Error("403");
      }),
    };
    await expect(deleteElementById(endpointApi, "answers", "answer-1", "r")).rejects.toThrow("403");
  });
});
