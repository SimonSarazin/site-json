import { describe, expect, it } from "vitest";
import { buildAacFormMeta, readOptionList } from "./formMeta";

/** Fabrique un doc `inputs` d'étape à partir d'une map inputKey → définition. */
function step(inputs: Record<string, Record<string, unknown>>) {
  return { inputs };
}

describe("readOptionList", () => {
  it("lit la clé nue `<key>.list`", () => {
    const opts = readOptionList({ tags: { list: ["Numérique", "Alimentation"] } }, "tags");
    expect(opts).toEqual([
      { value: "Numérique", label: "Numérique" },
      { value: "Alimentation", label: "Alimentation" },
    ]);
  });

  it("lit la variante préfixée `radioNew<key>.list`", () => {
    const opts = readOptionList(
      { radioNewq_matu: { list: ["Idée", "Prototype"] } },
      "q_matu"
    );
    expect(opts.map((o) => o.value)).toEqual(["Idée", "Prototype"]);
  });

  it("lit `checkboxNew<key>.list`", () => {
    const opts = readOptionList({ checkboxNewq_besoin: { list: ["A"] } }, "q_besoin");
    expect(opts).toEqual([{ value: "A", label: "A" }]);
  });

  it("objet associatif : value = clé, label = valeur", () => {
    const opts = readOptionList({ q: { list: { idee: "Idée", proto: "Prototype" } } }, "q");
    expect(opts).toEqual([
      { value: "idee", label: "Idée" },
      { value: "proto", label: "Prototype" },
    ]);
  });

  it("accepte `.options` et `.global.list`", () => {
    expect(readOptionList({ q: { options: ["X"] } }, "q")).toEqual([
      { value: "X", label: "X" },
    ]);
    expect(readOptionList({ q: { global: { list: ["Y"] } } }, "q")).toEqual([
      { value: "Y", label: "Y" },
    ]);
  });

  it("ignore les entrées vides et retourne [] si rien ne matche", () => {
    expect(readOptionList({ q: { list: ["", "  ", "Vrai"] } }, "q")).toEqual([
      { value: "Vrai", label: "Vrai" },
    ]);
    expect(readOptionList({}, "absent")).toEqual([]);
    expect(readOptionList(undefined, "absent")).toEqual([]);
  });
});

describe("buildAacFormMeta", () => {
  // Clés d'étape volontairement EXOTIQUES : rien ne doit dépendre de `aapStepN`.
  const form = {
    subForms: ["etapeA", "etapeB"],
    inputs: {
      etapeA: step({
        q_titre: { type: "text", label: "Titre du commun", position: 1 },
        q_desc: { type: "textarea", label: "Description", position: 2 },
        q_tags: { type: "tags", label: "Thématiques", position: 3 },
      }),
      etapeB: step({
        q_matu: { type: "tpls.forms.cplx.radioNew", label: "Maturité", position: 1 },
      }),
    },
    params: {
      q_tags: { list: ["Numérique", "Gouvernance"] },
      radioNewq_matu: { list: ["Idée", "Prototype", "En production"] },
    },
  };

  it("indexe les questions par id, avec libellé et type normalisé", () => {
    const meta = buildAacFormMeta("f1", form);
    expect(meta.formId).toBe("f1");
    expect(meta.byId.q_titre.label).toBe("Titre du commun");
    expect(meta.byId.q_titre.componentType).toBe("text");
    expect(meta.byId.q_desc.componentType).toBe("textarea");
    expect(meta.byId.q_matu.rawType).toBe("tpls.forms.cplx.radioNew");
  });

  it("rattache chaque question à SA clé d'étape, quelle qu'elle soit", () => {
    const meta = buildAacFormMeta("f1", form);
    expect(meta.byId.q_titre.stepKey).toBe("etapeA");
    expect(meta.byId.q_matu.stepKey).toBe("etapeB");
    expect(meta.byStep).toEqual({
      etapeA: ["q_titre", "q_desc", "q_tags"],
      etapeB: ["q_matu"],
    });
  });

  it("attache les options depuis form.params, clé nue ET variante préfixée", () => {
    const meta = buildAacFormMeta("f1", form);
    expect(meta.byId.q_tags.options.map((o) => o.value)).toEqual([
      "Numérique",
      "Gouvernance",
    ]);
    expect(meta.byId.q_matu.options.map((o) => o.value)).toEqual([
      "Idée",
      "Prototype",
      "En production",
    ]);
    expect(meta.byId.q_titre.options).toEqual([]);
  });

  it("trie par `position`, pas par ordre d'insertion", () => {
    const meta = buildAacFormMeta("f1", {
      subForms: ["etapeA"],
      inputs: {
        etapeA: step({
          b: { type: "text", label: "B", position: 2 },
          a: { type: "text", label: "A", position: 1 },
        }),
      },
    });
    expect(meta.byStep.etapeA).toEqual(["a", "b"]);
    expect(meta.order).toEqual(["a", "b"]);
  });

  it("lit quand même les options d'une question de type INCONNU", () => {
    // `tags` n'est pas mappé par coform (piège n°1 du doc AAC) : le composant
    // sort en "unknown", mais la liste d'options doit rester exploitable.
    const meta = buildAacFormMeta("f1", form);
    expect(meta.byId.q_tags.options).toHaveLength(2);
  });

  it("tolère un form vide ou malformé", () => {
    expect(buildAacFormMeta("f1", undefined)).toEqual({
      formId: "f1",
      byId: {},
      byStep: {},
      order: [],
      mapping: {},
    });
    expect(buildAacFormMeta("f1", { inputs: { s: {} } }).byStep).toEqual({ s: [] });
  });

  it("conserve `form.mapping` brut", () => {
    const meta = buildAacFormMeta("f1", {
      ...form,
      mapping: { title: "answers.etapeA.q_titre" },
    });
    expect(meta.mapping).toEqual({ title: "answers.etapeA.q_titre" });
  });

  it("ordonne les étapes selon subForms, puis les étapes non déclarées", () => {
    const meta = buildAacFormMeta("f1", {
      subForms: ["etapeB"],
      inputs: {
        etapeA: step({ a: { type: "text", label: "A" } }),
        etapeB: step({ b: { type: "text", label: "B" } }),
      },
    });
    expect(meta.order).toEqual(["b", "a"]);
  });
});
