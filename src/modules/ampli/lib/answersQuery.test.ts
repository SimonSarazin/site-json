import { describe, expect, it } from "vitest";
import { ampliAnswerFields, ampliAnswerFilters } from "./answersQuery";

/** Le périmètre partagé par la page ampli et les compteurs de `/ampli`. */

const PATH = { name: "step.name", address: "step.address", tags: "step.tags" };

describe("ampliAnswerFilters", () => {
  it("filtre sur le formulaire et sur l'existence du nom", () => {
    expect(ampliAnswerFilters("coform-1", PATH)).toEqual({
      form: "coform-1",
      finderPath: "",
      "answers.step.name": { $exists: true },
    });
  });

  it("reprend le finder quand il est déclaré", () => {
    expect(ampliAnswerFilters("coform-1", { ...PATH, finder: "step.finder" }).finderPath).toBe("step.finder");
  });
});

describe("ampliAnswerFields", () => {
  it("projette les champs du mapping, l'auteur et les réactions", () => {
    expect(ampliAnswerFields(PATH)).toEqual([
      "answers.step.name",
      "answers.step.address",
      "answers.step.tags",
      "user",
      "vote",
      "voteCount",
    ]);
  });

  // Un rôle optionnel non renseigné ne doit pas devenir `answers.undefined`.
  it("ignore les rôles non renseignés", () => {
    expect(ampliAnswerFields({ ...PATH, description: undefined, image: "" })).not.toContain("answers.undefined");
    expect(ampliAnswerFields({ ...PATH, description: undefined, image: "" })).not.toContain("answers.");
  });
});
