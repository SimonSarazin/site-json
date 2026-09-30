// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  editorIdsOf,
  editorsWrites,
  readCommunEditors,
  resolveEditorsQuestion,
  toEditorsLinkValue,
  toEditorsQuestionValue,
  type EditorsQuestion,
} from "./communEditors";
import type { AacFormMeta } from "./formMeta";

/**
 * Contributeurs à l'édition : `links.canEdit` ∪ la question finder déclarée par
 * `addToLinks.links = "canEdit"`. Les identifiants reprennent la forme de la base CAE.
 */

const INPUT = "aapStep1m0w402djpsq3i44017";
const FIELD = `finder${INPUT}`;
const A = "5dfa41886908648d3b8b46f6";
const B = "57618d6640bb4ece776308aa";
const C = "64785065919b8815ad72cf94";

const META: AacFormMeta = {
  formId: "677e7e389058e31575550ac8",
  byId: {
    titre: { stepKey: "aapStep1", id: "titre", label: "Titre", rawType: "text", componentType: "text", options: [], position: 0 },
    [INPUT]: {
      stepKey: "aapStep1",
      id: INPUT,
      label: "Référent du commun",
      rawType: "tpls.forms.cplx.finder",
      componentType: "finder",
      options: [],
      position: 1,
    },
  },
  byStep: { aapStep1: ["titre", INPUT] },
  order: ["titre", INPUT],
  mapping: {},
};

const PARAMS_LIES = { [FIELD]: { type: "citoyens", addToLinks: { value: true, links: "canEdit" } } };
const QUESTION: EditorsQuestion = { stepKey: "aapStep1", label: "Référent du commun", fieldName: FIELD, path: `answers.aapStep1.${FIELD}` };

const answer = (canEdit: unknown, referents: unknown) => ({
  links: { canEdit },
  answers: { aapStep1: { titre: "Yeswiki", [FIELD]: referents } },
});

describe("resolveEditorsQuestion", () => {
  it("trouve la question que le formulaire déclare, avec son chemin d'écriture", () => {
    expect(resolveEditorsQuestion(META, PARAMS_LIES)).toEqual(QUESTION);
  });

  it("sans `addToLinks`, aucune question — rien n'est codé en dur", () => {
    expect(resolveEditorsQuestion(META, { [FIELD]: { type: "citoyens" } })).toBeNull();
    expect(resolveEditorsQuestion(META, {})).toBeNull();
  });

  it("un autre lien que `canEdit` n'est pas celui des contributeurs à l'édition", () => {
    expect(resolveEditorsQuestion(META, { [FIELD]: { addToLinks: { value: true, links: "contributors" } } })).toBeNull();
  });

  it("une config qui désigne une question absente du formulaire n'ouvre aucune écriture", () => {
    expect(resolveEditorsQuestion(META, { finderInconnue: { addToLinks: { value: true, links: "canEdit" } } })).toBeNull();
    expect(resolveEditorsQuestion(null, PARAMS_LIES)).toBeNull();
  });
});

describe("lecture", () => {
  it("les identifiants viennent de `links.canEdit`, et de lui seul", () => {
    expect(editorIdsOf(answer({ [A]: { name: "A", type: "citoyens" } }, { [B]: { id: B, name: "B", type: "citoyens" } }))).toEqual([A]);
    expect(editorIdsOf(answer([], null))).toEqual([]);
    expect(editorIdsOf({})).toEqual([]);
  });

  it("la liste présentée est l'UNION des deux sources ; un nom connu d'un côté complète l'autre", () => {
    const editors = readCommunEditors(
      answer({ [A]: { name: "", type: "citoyens" }, [B]: { name: "B", type: "citoyens" } }, { [A]: { id: A, name: "A", type: "citoyens" }, [C]: { id: C, name: "C", type: "citoyens" } }),
      QUESTION
    );
    expect(Object.keys(editors).sort()).toEqual([A, B, C].sort());
    expect(editors[A]).toEqual({ id: A, name: "A", type: "citoyens" });
  });

  it("sans question déclarée, seul `links.canEdit` compte", () => {
    const editors = readCommunEditors(answer({ [A]: { name: "A", type: "citoyens" } }, { [C]: { id: C, name: "C", type: "citoyens" } }), null);
    expect(Object.keys(editors)).toEqual([A]);
  });
});

describe("écriture", () => {
  const liste = { [A]: { id: A, name: "A", type: "citoyens" as const }, [C]: { id: C, name: "C", type: "citoyens" as const } };

  it("le lien garde ses entrées existantes telles quelles, les nouvelles prennent la forme { name, type }", () => {
    const actuel = answer({ [A]: { name: "A", type: "citoyens", profilThumbImageUrl: "/a.png" }, [B]: { name: "B", type: "citoyens" } }, null);
    expect(toEditorsLinkValue(liste, actuel)).toEqual({
      [A]: { name: "A", type: "citoyens", profilThumbImageUrl: "/a.png" },
      [C]: { name: "C", type: "citoyens" },
    });
  });

  /** La relecture SDK rend les vignettes absolues : l'entrée conservée reprend sa forme stockée. */
  it("une vignette relue ABSOLUE par le SDK repart relative, comme en base", () => {
    const actuel = answer({ [A]: { name: "A", type: "citoyens", profilThumbImageUrl: "http://co.example/assets/a.png" } }, null);
    expect(toEditorsLinkValue(liste, actuel)?.[A]).toEqual({ name: "A", type: "citoyens", profilThumbImageUrl: "/assets/a.png" });
  });

  it("la question prend la forme d'une valeur de finder { id, name, type }", () => {
    expect(toEditorsQuestionValue(liste, answer(null, null), QUESTION)).toEqual({
      [A]: { id: A, name: "A", type: "citoyens" },
      [C]: { id: C, name: "C", type: "citoyens" },
    });
  });

  it("une liste vide s'écrit `null` — un `$unset`, pas un objet vide", () => {
    expect(toEditorsLinkValue({}, answer({ [A]: { name: "A" } }, null))).toBeNull();
    expect(toEditorsQuestionValue({}, answer(null, { [A]: { id: A } }), QUESTION)).toBeNull();
  });
});

describe("editorsWrites", () => {
  const deux = { [A]: { id: A, name: "A", type: "citoyens" as const }, [B]: { id: B, name: "B", type: "citoyens" as const } };

  it("deux sources alignées et une liste inchangée : rien à écrire", () => {
    const aligne = answer({ [A]: {}, [B]: {} }, { [A]: { id: A }, [B]: { id: B } });
    expect(editorsWrites(deux, aligne, QUESTION)).toEqual({ link: false, question: false });
  });

  /** Le cas réel de la base : `links.canEdit` et la question divergent déjà. */
  it("deux sources divergentes : l'union s'écrit des deux côtés, sans rien toucher à l'écran", () => {
    const diverge = answer({ [A]: {} }, { [B]: { id: B } });
    expect(editorsWrites(deux, diverge, QUESTION)).toEqual({ link: true, question: true });
  });

  it("sans question déclarée, seul le lien s'écrit", () => {
    expect(editorsWrites(deux, answer({ [A]: {} }, null), null)).toEqual({ link: true, question: false });
  });
});
