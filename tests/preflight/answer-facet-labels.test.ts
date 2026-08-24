import { describe, it, expect } from "vitest";
// @ts-expect-error — script JS sans typage, on n'en teste que les helpers purs.
import { groupesCiblantLesAnswers, cleInput, libellesDe, libellesInexprimables } from "../../scripts/answer-facet-labels.mjs";

/**
 * La partie RÉSEAU de `scripts/answer-facet-labels.mjs` ne peut pas être testée ici (les
 * options d'une facette vivent dans le formulaire, en base). On prouve donc la logique
 * pure : parcours de config, lecture du document Form, détection du libellé à point.
 */
describe("garde des libellés de facettes (helpers purs)", () => {
  const cfg = {
    pages: [
      {
        path: "/creneaux",
        sections: [
          {
            type: "gridLayout",
            props: {
              leftSection: {
                type: "filters",
                props: {
                  filtersByAnswers: {
                    ald: { filterTarget: "answers", forms: "F1", path: "eki_0.multiCheckboxPluseki_0ald" },
                    // sans filterTarget → hors périmètre de cette garde
                    services: { forms: "F1", path: "eki_0.multiCheckboxPluseki_0svc" },
                    // ciblant les answers mais sans form → rien à interroger
                    orphelin: { filterTarget: "answers", path: "eki_0.x" },
                  },
                },
              },
            },
          },
        ],
      },
    ],
  };

  it("ne retient que les groupes ciblant les answers ET rattachés à un form", () => {
    const g = groupesCiblantLesAnswers([{ site: "tampon", cfg }]);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ form: "F1", chemin: "eki_0.multiCheckboxPluseki_0ald" });
    expect(g[0].ref).toContain("/creneaux/ald");
  });

  it("la clé d'input est le DERNIER segment du chemin", () => {
    expect(cleInput("eki_0.multiCheckboxPluseki_0ald")).toBe("multiCheckboxPluseki_0ald");
  });

  it("lit les options sous `params[input].global.list` (liste ou objet)", () => {
    const doc = { params: { champ: { global: { list: ["Obésité", "Cancer"] } } } };
    expect(libellesDe(doc, "s.champ")).toEqual(["Obésité", "Cancer"]);
    const objet = { params: { champ: { global: { list: { "Obésité": {}, Cancer: {} } } } } };
    expect(libellesDe(objet, "s.champ")).toEqual(["Obésité", "Cancer"]);
    expect(libellesDe({}, "s.champ")).toEqual([]);
  });

  it("signale le libellé à point d'un multiCheckboxPlus, et lui seul", () => {
    const labels = ["Obésité", "Facilitateur.rice de Tiers-Lieux", "etc."];
    expect(libellesInexprimables("s.multiCheckboxPlusX", labels)).toEqual([
      "Facilitateur.rice de Tiers-Lieux",
      "etc.",
    ]);
    // Sur un input dont le libellé part en VALEUR, un point est inoffensif.
    expect(libellesInexprimables("s.multiRadioX", labels)).toEqual([]);
  });
});
