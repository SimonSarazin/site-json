import { describe, expect, it, vi } from "vitest";
import type { Answer } from "@communecter/cocolight-api-client";
import { appendAnswerDepense } from "./actionMilestonePathUpdates";

function answerMock() {
  const updateField = vi.fn().mockResolvedValue(undefined);
  return { answer: { updateField } as unknown as Answer, updateField };
}

/**
 * H22 (résiduel §11.6) : `description` vit sur la DÉPENSE — c'est `depense.description`
 * que relisent la fiche commun et la modale d'édition (`useCagnotteAdapter`,
 * `buildItemsFromRawDepenses`, `fundableItemToMilestone`). L'édition l'y écrit
 * depuis b3ab0d9b ; la création (`useCreateMilestone` → `appendAnswerDepense`) ne
 * la portait pas, et un palier créé avec projet lié apparaissait sans description.
 */
describe("appendAnswerDepense", () => {
  it("écrit la description sur la dépense ajoutée, avec le reste de la ligne", async () => {
    const { answer, updateField } = answerMock();

    await appendAnswerDepense({
      answer,
      depense: {
        poste: "Prototype",
        description: "Une première version testable",
        price: 1200,
        date: "2026-09-09T00:00:00.000Z",
        user: "u1",
        milestone: "m1",
        financer: [],
      },
    });

    expect(updateField).toHaveBeenCalledTimes(1);
    const [path, value, options] = updateField.mock.calls[0];
    expect(path).toBe("answers.aapStep1.depense");
    expect(value).toMatchObject({ poste: "Prototype", description: "Une première version testable", price: 1200, milestone: "m1" });
    expect(options).toMatchObject({ arrayForm: true });
  });

  it("sans description fournie, n'en invente pas : la ligne reste telle que l'appelant l'a donnée", async () => {
    const { answer, updateField } = answerMock();

    await appendAnswerDepense({
      answer,
      step: "aapStep2",
      depense: { poste: "Legacy", price: 0, date: "2026-09-09T00:00:00.000Z", user: "u1", milestone: "m2", financer: [] },
    });

    const [path, value] = updateField.mock.calls[0];
    expect(path).toBe("answers.aapStep2.depense");
    expect(value).not.toHaveProperty("description");
  });
});
