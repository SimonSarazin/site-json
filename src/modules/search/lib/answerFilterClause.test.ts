import { describe, it, expect } from "vitest";
import {
  ANSWER_PATH_TYPE,
  answerFilterClause,
  answerGroupFieldPath,
  answerToggleArgs,
} from "./answerFilterClause";

const MCP = "answers.eki_0.multiCheckboxPluseki_0abc";

describe("answerGroupFieldPath", () => {
  it("sans filterTarget → null (comportement historique : filtre par _id)", () => {
    expect(answerGroupFieldPath({ path: "eki_0.multiCheckboxPluseki_0abc" })).toBeNull();
    expect(answerGroupFieldPath({ filterTarget: "linkedElements", path: "x" })).toBeNull();
    expect(answerGroupFieldPath(undefined)).toBeNull();
  });

  it("filterTarget answers → chemin préfixé par `answers.` (path ou thematicPath)", () => {
    expect(answerGroupFieldPath({ filterTarget: "answers", path: "eki_0.champ" })).toBe(
      "answers.eki_0.champ",
    );
    expect(
      answerGroupFieldPath({ filterTarget: "answers", thematicPath: "eki_0.champ" }),
    ).toBe("answers.eki_0.champ");
  });

  it("chemin déjà préfixé : pas de double `answers.`", () => {
    expect(answerGroupFieldPath({ filterTarget: "answers", path: "answers.eki_0.champ" })).toBe(
      "answers.eki_0.champ",
    );
  });

  it("filterTarget answers SANS chemin → null (le groupe retombe sur _id, pas de filtre mort)", () => {
    expect(answerGroupFieldPath({ filterTarget: "answers" })).toBeNull();
  });
});

/**
 * Table portée de `answerDirectory.js:1264-1290` (legacy, fait foi). Un écart ici
 * produit un filtre qui ne matche rien — panne silencieuse, pas une erreur.
 */
describe("answerFilterClause — table de dispatch legacy", () => {
  it("multiCheckboxPlus : libellé en CLÉ → $exists sur la clé dotée", () => {
    expect(answerFilterClause(MCP, "Obésité")).toEqual({ [`${MCP}.Obésité`]: { $exists: true } });
  });

  it("multiRadio : libellé en VALEUR sous `.value`", () => {
    const p = "answers.eki_0.multiRadioeki_0abc";
    expect(answerFilterClause(p, "Mixte")).toEqual({ [`${p}.value`]: "Mixte" });
  });

  it("checkboxNew / radioNew : préfixe de type retiré du chemin, libellé en valeur", () => {
    expect(answerFilterClause("answers.eki_0.checkboxNeweki_0abc", "Oui")).toEqual({
      "answers.eki_0.eki_0abc": "Oui",
    });
    expect(answerFilterClause("answers.eki_0.radioNeweki_0abc", "Oui")).toEqual({
      "answers.eki_0.eki_0abc": "Oui",
    });
  });

  it("champ simple : égalité directe", () => {
    expect(answerFilterClause("answers.eki_0.champ", "Validé")).toEqual({
      "answers.eki_0.champ": "Validé",
    });
  });

  it("multiCheckboxPlus + libellé À POINT → null (inexprimable en clé dotée)", () => {
    // 819 libellés du parc sont dans ce cas (« Facilitateur.rice de Tiers-Lieux ») :
    // la clé dotée deviendrait un niveau de chemin et ne matcherait JAMAIS.
    expect(answerFilterClause(MCP, "Facilitateur.rice de Tiers-Lieux")).toBeNull();
  });

  it("un point est INOFFENSIF quand le libellé est en position de valeur", () => {
    const p = "answers.eki_0.multiRadioeki_0abc";
    expect(answerFilterClause(p, "etc. et plus")).toEqual({ [`${p}.value`]: "etc. et plus" });
  });

  it("chemin ou valeur vide → null", () => {
    expect(answerFilterClause("", "x")).toBeNull();
    expect(answerFilterClause(MCP, "")).toBeNull();
  });
});

describe("answerToggleArgs", () => {
  const option = { name: "Obésité", orgaNameArray: ["6a7b4da9212fb41f050d2e4e"] };

  it("groupe historique → { field: '_id', value: orgaNameArray } (INCHANGÉ)", () => {
    expect(answerToggleArgs({ path: "eki_0.x" }, "Obésité", option)).toEqual({
      field: "_id",
      value: ["6a7b4da9212fb41f050d2e4e"],
      fieldType: null,
    });
  });

  it("groupe ciblant les answers → prédicat de chemin, l'orgaNameArray est ignoré", () => {
    expect(
      answerToggleArgs(
        { filterTarget: "answers", path: "eki_0.multiCheckboxPluseki_0abc" },
        "Obésité",
        option,
      ),
    ).toEqual({
      field: "answers.eki_0.multiCheckboxPluseki_0abc",
      value: ["Obésité"],
      fieldType: ANSWER_PATH_TYPE,
    });
  });

  it("sans `name`, la CLÉ de l'option fait foi", () => {
    expect(
      answerToggleArgs({ filterTarget: "answers", path: "eki_0.champ" }, "Diabète", {}).value,
    ).toEqual(["Diabète"]);
  });
});
