import { describe, expect, it } from "vitest";
import {
  denormalizeAnswerData,
  extractFinderLinks,
  generateDefaultValues,
  generateZodSchema,
  getFieldNameWithPrefix,
  getOriginalFieldKey,
  hasFieldPrefix,
  isRootLevelField,
  mapCoFormTypeToComponentType,
  normalizeAnswerData,
  parseCoFormFields,
} from "./formParser";
import type {
  CoFormData,
  FormFieldMapping,
  SubFormFields,
} from "../types";

/**
 * Tests unitaires pour formParser.ts — module central de parsing CoForm.
 *
 * Couvre :
 *  - Helpers de préfixes (isRootLevelField, getFieldNameWithPrefix, getOriginalFieldKey, hasFieldPrefix).
 *  - mapCoFormTypeToComponentType : mapping types PHP → composants React.
 *  - parseCoFormFields : transformation CoFormData → SubFormFields[].
 *  - generateDefaultValues : valeurs par défaut par type de champ.
 *  - generateZodSchema : validation Zod générée dynamiquement.
 *  - normalizeAnswerData / denormalizeAnswerData : round-trip root-level fields.
 *  - extractFinderLinks : extraction des liens finder pour answer.links.
 */

// ============================================================================
// Helpers de fixtures
// ============================================================================

function makeField(overrides: Partial<FormFieldMapping> = {}): FormFieldMapping {
  return {
    name: "field1",
    label: "Field 1",
    type: "text",
    componentType: "text",
    isRequired: false,
    ...overrides,
  };
}

function makeSubFormFields(fields: FormFieldMapping[], subFormId = "step1"): SubFormFields {
  return {
    subFormId,
    subFormName: `Step ${subFormId}`,
    fields,
  };
}

function makeCoFormData(overrides: Partial<CoFormData> = {}): CoFormData {
  return {
    _id: { $id: "form123" },
    id: "form123",
    name: "Test Form",
    created: 0,
    creator: "creator1",
    type: "form",
    inputs: {},
    ...overrides,
  };
}

// ============================================================================
// Helpers de préfixes
// ============================================================================

describe("isRootLevelField", () => {
  it("retourne true pour evaluation (root-level)", () => {
    expect(isRootLevelField("evaluation")).toBe(true);
  });

  it("retourne false pour text/textarea/radio/checkbox/...", () => {
    expect(isRootLevelField("text")).toBe(false);
    expect(isRootLevelField("textarea")).toBe(false);
    expect(isRootLevelField("radio")).toBe(false);
    expect(isRootLevelField("checkbox")).toBe(false);
    expect(isRootLevelField("finder")).toBe(false);
    expect(isRootLevelField("multiCheckboxPlus")).toBe(false);
    expect(isRootLevelField("multiRadio")).toBe(false);
  });
});

describe("getFieldNameWithPrefix", () => {
  it("ajoute le préfixe `finder` aux champs finder", () => {
    expect(getFieldNameWithPrefix("finder", "abc123")).toBe("finderabc123");
  });

  it("ajoute le préfixe `multiCheckboxPlus` aux champs multiCheckboxPlus", () => {
    expect(getFieldNameWithPrefix("multiCheckboxPlus", "xyz")).toBe("multiCheckboxPlusxyz");
  });

  it("ajoute le préfixe `multiRadio` aux champs multiRadio", () => {
    expect(getFieldNameWithPrefix("multiRadio", "key1")).toBe("multiRadiokey1");
  });

  it("ajoute le préfixe `evaluation` aux champs evaluation", () => {
    expect(getFieldNameWithPrefix("evaluation", "k1")).toBe("evaluationk1");
  });

  it("ne préfixe pas les champs text/textarea/radio/checkbox/select/...", () => {
    expect(getFieldNameWithPrefix("text", "myKey")).toBe("myKey");
    expect(getFieldNameWithPrefix("textarea", "myKey")).toBe("myKey");
    expect(getFieldNameWithPrefix("radio", "myKey")).toBe("myKey");
    expect(getFieldNameWithPrefix("checkbox", "myKey")).toBe("myKey");
    expect(getFieldNameWithPrefix("select", "myKey")).toBe("myKey");
    expect(getFieldNameWithPrefix("uploader", "myKey")).toBe("myKey");
  });
});

describe("getOriginalFieldKey", () => {
  it("retire le préfixe `finder` d'un champ finder", () => {
    const field = makeField({ componentType: "finder", name: "finderabc123" });
    expect(getOriginalFieldKey(field)).toBe("abc123");
  });

  it("retire le préfixe `multiCheckboxPlus`", () => {
    const field = makeField({ componentType: "multiCheckboxPlus", name: "multiCheckboxPlusXYZ" });
    expect(getOriginalFieldKey(field)).toBe("XYZ");
  });

  it("retourne le nom inchangé si pas de préfixe applicable", () => {
    const field = makeField({ componentType: "text", name: "myKey" });
    expect(getOriginalFieldKey(field)).toBe("myKey");
  });

  it("retourne le nom inchangé si le préfixe attendu n'est pas présent", () => {
    // Edge case : finder mais nom ne commence pas par "finder"
    const field = makeField({ componentType: "finder", name: "other_name" });
    expect(getOriginalFieldKey(field)).toBe("other_name");
  });
});

describe("hasFieldPrefix", () => {
  it("retourne true pour les types préfixés", () => {
    expect(hasFieldPrefix("finder")).toBe(true);
    expect(hasFieldPrefix("multiCheckboxPlus")).toBe(true);
    expect(hasFieldPrefix("multiRadio")).toBe(true);
    expect(hasFieldPrefix("evaluation")).toBe(true);
  });

  it("retourne false pour les types sans préfixe", () => {
    expect(hasFieldPrefix("text")).toBe(false);
    expect(hasFieldPrefix("textarea")).toBe(false);
    expect(hasFieldPrefix("checkbox")).toBe(false);
    expect(hasFieldPrefix("select")).toBe(false);
    expect(hasFieldPrefix("uploader")).toBe(false);
    expect(hasFieldPrefix("simpleTable")).toBe(false);
  });
});

// ============================================================================
// mapCoFormTypeToComponentType
// ============================================================================

describe("mapCoFormTypeToComponentType", () => {
  it("mappe les types text natifs", () => {
    expect(mapCoFormTypeToComponentType("text")).toBe("text");
    expect(mapCoFormTypeToComponentType("url")).toBe("text");
    expect(mapCoFormTypeToComponentType("email")).toBe("text");
    expect(mapCoFormTypeToComponentType("tel")).toBe("text");
    expect(mapCoFormTypeToComponentType("number")).toBe("text");
  });

  it("mappe textarea", () => {
    expect(mapCoFormTypeToComponentType("textarea")).toBe("textarea");
  });

  it("mappe les types tpls.forms.cplx.*", () => {
    expect(mapCoFormTypeToComponentType("tpls.forms.cplx.radioNew")).toBe("radio");
    expect(mapCoFormTypeToComponentType("tpls.forms.cplx.multiRadio")).toBe("multiRadio");
    expect(mapCoFormTypeToComponentType("tpls.forms.cplx.checkboxNew")).toBe("checkbox");
    expect(mapCoFormTypeToComponentType("tpls.forms.cplx.multiCheckboxPlus")).toBe("multiCheckboxPlus");
    expect(mapCoFormTypeToComponentType("tpls.forms.cplx.evaluation")).toBe("evaluation");
    expect(mapCoFormTypeToComponentType("tpls.forms.cplx.finder")).toBe("finder");
    expect(mapCoFormTypeToComponentType("tpls.forms.cplx.simpleTable")).toBe("simpleTable");
  });

  it("mappe les variants alternatifs", () => {
    expect(mapCoFormTypeToComponentType("tpls.forms.evaluation.evaluation")).toBe("evaluation");
    expect(mapCoFormTypeToComponentType("tpls.forms.finder.finder")).toBe("finder");
    expect(mapCoFormTypeToComponentType("tpls.forms.uploader")).toBe("uploader");
  });

  it("mappe les sections", () => {
    expect(mapCoFormTypeToComponentType("sectionTitle")).toBe("sectionTitle");
    expect(mapCoFormTypeToComponentType("tpls.forms.sectionTitle")).toBe("sectionTitle");
    expect(mapCoFormTypeToComponentType("tpls.forms.sectionDescription")).toBe("sectionDescription");
  });

  it("mappe select", () => {
    expect(mapCoFormTypeToComponentType("select")).toBe("select");
  });

  it("retourne 'unknown' pour un type non mappé", () => {
    expect(mapCoFormTypeToComponentType("unknown.type")).toBe("unknown");
    expect(mapCoFormTypeToComponentType("")).toBe("unknown");
  });
});

// ============================================================================
// parseCoFormFields
// ============================================================================

describe("parseCoFormFields", () => {
  it("retourne tableau vide si pas d'inputs", () => {
    expect(parseCoFormFields(makeCoFormData({ inputs: null }))).toEqual([]);
    expect(parseCoFormFields(makeCoFormData({ inputs: {} }))).toEqual([]);
  });

  it("parse un champ text simple", () => {
    const formData = makeCoFormData({
      inputs: {
        step1: {
          name: "Step 1",
          id: "step1",
          formParent: "form123",
          inputs: {
            myField: {
              label: "My Field",
              type: "text",
              isRequired: true,
            },
          },
        },
      },
    });

    const result = parseCoFormFields(formData);
    expect(result).toHaveLength(1);
    expect(result[0].subFormId).toBe("step1");
    expect(result[0].fields).toHaveLength(1);
    expect(result[0].fields[0]).toMatchObject({
      label: "My Field",
      type: "text",
      componentType: "text",
      isRequired: true,
    });
  });

  it("ignore les anciens inputs de validation d'étape (validateStep*)", () => {
    const formData = makeCoFormData({
      inputs: {
        step1: {
          name: "Step 1",
          id: "step1",
          formParent: "form123",
          inputs: {
            validateStep1: { type: "validateStep" },
            realField: { type: "text", label: "Real" },
          },
        },
      },
    });

    const result = parseCoFormFields(formData);
    expect(result[0].fields).toHaveLength(1);
    expect(result[0].fields[0].label).toBe("Real");
  });

  it("préfixe correctement les champs finder/multiCheckboxPlus/etc.", () => {
    const formData = makeCoFormData({
      inputs: {
        step1: {
          name: "Step 1",
          id: "step1",
          formParent: "form123",
          inputs: {
            xyz: {
              label: "My Finder",
              type: "tpls.forms.finder.finder",
            },
          },
        },
      },
    });

    const result = parseCoFormFields(formData);
    expect(result[0].fields[0].name).toBe("finderxyz");
    expect(result[0].fields[0].componentType).toBe("finder");
  });

  it("parse plusieurs subForms", () => {
    const formData = makeCoFormData({
      inputs: {
        step1: {
          name: "Step 1",
          id: "step1",
          formParent: "form123",
          inputs: { f1: { type: "text", label: "F1" } },
        },
        step2: {
          name: "Step 2",
          id: "step2",
          formParent: "form123",
          inputs: { f2: { type: "text", label: "F2" } },
        },
      },
    });

    const result = parseCoFormFields(formData);
    expect(result).toHaveLength(2);
    expect(result[0].subFormId).toBe("step1");
    expect(result[1].subFormId).toBe("step2");
  });
});

// ============================================================================
// generateDefaultValues
// ============================================================================

describe("generateDefaultValues", () => {
  it("retourne objet vide pour aucun champ", () => {
    expect(generateDefaultValues([])).toEqual({});
  });

  it("text required → '', non-required → undefined", () => {
    const result = generateDefaultValues([
      makeSubFormFields([
        makeField({ name: "f1", componentType: "text", isRequired: true }),
        makeField({ name: "f2", componentType: "text", isRequired: false }),
      ]),
    ]);
    expect(result.f1).toBe("");
    expect(result.f2).toBeUndefined();
  });

  it("checkbox → []", () => {
    const result = generateDefaultValues([
      makeSubFormFields([makeField({ name: "cb", componentType: "checkbox" })]),
    ]);
    expect(result.cb).toEqual([]);
  });

  it("multiRadio → { value: '' }", () => {
    const result = generateDefaultValues([
      makeSubFormFields([makeField({ name: "mr", componentType: "multiRadio" })]),
    ]);
    expect(result.mr).toEqual({ value: "" });
  });

  it("multiCheckboxPlus → []", () => {
    const result = generateDefaultValues([
      makeSubFormFields([makeField({ name: "mcp", componentType: "multiCheckboxPlus" })]),
    ]);
    expect(result.mcp).toEqual([]);
  });

  it("evaluation → {}", () => {
    const result = generateDefaultValues([
      makeSubFormFields([makeField({ name: "ev", componentType: "evaluation" })]),
    ]);
    expect(result.ev).toEqual({});
  });

  it("finder → null", () => {
    const result = generateDefaultValues([
      makeSubFormFields([makeField({ name: "fi", componentType: "finder" })]),
    ]);
    expect(result.fi).toBeNull();
  });

  it("uploader → []", () => {
    const result = generateDefaultValues([
      makeSubFormFields([makeField({ name: "up", componentType: "uploader" })]),
    ]);
    expect(result.up).toEqual([]);
  });

  it("simpleTable → tableau 2D si config présente", () => {
    const field = makeField({
      name: "tbl",
      componentType: "simpleTable",
      simpleTableConfig: {
        tableName: "T",
        columns: [
          { label: "Col1", type: "Text" },
          { label: "Col2", type: "Images" },
        ],
        rows: [{ label: "Row1" }],
        activeNewLine: false,
        singleAnswerByLine: false,
      },
    });
    const result = generateDefaultValues([makeSubFormFields([field])]);
    expect(result.tbl).toEqual([
      ["T", "Col1", "Col2"],
      ["Row1", "", []],
    ]);
  });

  it("simpleTable → [] si config absente", () => {
    const result = generateDefaultValues([
      makeSubFormFields([makeField({ name: "tbl", componentType: "simpleTable" })]),
    ]);
    expect(result.tbl).toEqual([]);
  });
});

// ============================================================================
// generateZodSchema
// ============================================================================

describe("generateZodSchema", () => {
  it("retourne un schéma Zod valide", () => {
    const schema = generateZodSchema([
      makeSubFormFields([makeField({ name: "f1", componentType: "text", isRequired: false })]),
    ]);
    expect(schema.parse({ f1: "hello" })).toEqual({ f1: "hello" });
  });

  it("text required ne peut pas être vide", () => {
    const schema = generateZodSchema([
      makeSubFormFields([makeField({ name: "f1", componentType: "text", isRequired: true })]),
    ]);
    expect(() => schema.parse({ f1: "" })).toThrow();
  });

  it("text required accepte une string non vide", () => {
    const schema = generateZodSchema([
      makeSubFormFields([makeField({ name: "f1", componentType: "text", isRequired: true })]),
    ]);
    expect(schema.parse({ f1: "valid" })).toEqual({ f1: "valid" });
  });

  it("text non-required accepte chaîne vide", () => {
    const schema = generateZodSchema([
      makeSubFormFields([makeField({ name: "f1", componentType: "text", isRequired: false })]),
    ]);
    expect(() => schema.parse({ f1: "" })).not.toThrow();
  });

  it("checkbox required exige au moins une sélection", () => {
    const schema = generateZodSchema([
      makeSubFormFields([makeField({ name: "cb", componentType: "checkbox", isRequired: true })]),
    ]);
    expect(() => schema.parse({ cb: [] })).toThrow();
    expect(schema.parse({ cb: ["option1"] })).toEqual({ cb: ["option1"] });
  });

  it("inputType email ne valide PAS le format côté Zod (validation HTML5 + serveur)", () => {
    // Note : le schéma Zod ne distingue pas inputType — c'est l'attribut HTML `type="email"`
    // qui assure la validation côté navigateur. Le schéma reste `z.string().min(1)` pour required.
    const schema = generateZodSchema([
      makeSubFormFields([
        makeField({ name: "em", componentType: "text", inputType: "email", isRequired: true }),
      ]),
    ]);
    expect(schema.parse({ em: "anything-string" })).toEqual({ em: "anything-string" });
  });
});

// ============================================================================
// normalizeAnswerData
// ============================================================================

describe("normalizeAnswerData", () => {
  it("retourne undefined pour null/undefined", () => {
    expect(normalizeAnswerData(null, [])).toBeUndefined();
    expect(normalizeAnswerData(undefined, [])).toBeUndefined();
  });

  it("retourne les données telles quelles si aucun champ root-level", () => {
    const raw = { step1: { f1: "value" } };
    const fields: SubFormFields[] = [
      makeSubFormFields([makeField({ name: "f1", componentType: "text" })], "step1"),
    ];
    expect(normalizeAnswerData(raw, fields)).toEqual({ step1: { f1: "value" } });
  });

  it("déplace un champ evaluation depuis la racine vers son subform", () => {
    const raw = {
      step1: { otherField: "x" },
      evaluationXYZ: { vote: 5 },
    };
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [
          makeField({ name: "otherField", componentType: "text" }),
          makeField({ name: "evaluationXYZ", componentType: "evaluation" }),
        ],
        "step1",
      ),
    ];
    const result = normalizeAnswerData(raw, fields) as Record<string, unknown>;
    const step1 = result.step1 as Record<string, unknown>;
    expect(step1.evaluationXYZ).toEqual({ vote: 5 });
    expect(step1.otherField).toBe("x");
  });

  it("ne mute pas l'objet original", () => {
    const raw = { evaluationXYZ: { vote: 5 } };
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [makeField({ name: "evaluationXYZ", componentType: "evaluation" })],
        "step1",
      ),
    ];
    normalizeAnswerData(raw, fields);
    // Original inchangé
    expect(raw).toEqual({ evaluationXYZ: { vote: 5 } });
  });

  it("crée le subform vide si absent dans rawAnswers", () => {
    const raw = { evaluationXYZ: { vote: 5 } };
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [makeField({ name: "evaluationXYZ", componentType: "evaluation" })],
        "step1",
      ),
    ];
    const result = normalizeAnswerData(raw, fields) as Record<string, unknown>;
    expect(result.step1).toBeDefined();
    expect((result.step1 as Record<string, unknown>).evaluationXYZ).toEqual({ vote: 5 });
  });
});

// ============================================================================
// denormalizeAnswerData
// ============================================================================

describe("denormalizeAnswerData", () => {
  it("déplace un champ evaluation depuis le subform vers la racine", () => {
    const formData = {
      step1: {
        textField: "hello",
        evaluationXYZ: { vote: 5 },
      },
    };
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [
          makeField({ name: "textField", componentType: "text" }),
          makeField({ name: "evaluationXYZ", componentType: "evaluation" }),
        ],
        "step1",
      ),
    ];
    const result = denormalizeAnswerData(formData, fields);
    expect(result.evaluationXYZ).toEqual({ vote: 5 });
    const step1 = result.step1 as Record<string, unknown>;
    expect(step1.evaluationXYZ).toBeUndefined();
    expect(step1.textField).toBe("hello");
  });

  it("ne mute pas l'objet original", () => {
    const formData = { step1: { evaluationXYZ: { vote: 5 } } };
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [makeField({ name: "evaluationXYZ", componentType: "evaluation" })],
        "step1",
      ),
    ];
    denormalizeAnswerData(formData, fields);
    expect(formData).toEqual({ step1: { evaluationXYZ: { vote: 5 } } });
  });

  it("retourne les données telles quelles si aucun champ root-level", () => {
    const formData = { step1: { f1: "value" } };
    const fields: SubFormFields[] = [
      makeSubFormFields([makeField({ name: "f1", componentType: "text" })], "step1"),
    ];
    expect(denormalizeAnswerData(formData, fields)).toEqual({ step1: { f1: "value" } });
  });

  it("ignore les subForms absents dans formData", () => {
    const formData = {};
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [makeField({ name: "evaluationXYZ", componentType: "evaluation" })],
        "step1",
      ),
    ];
    expect(denormalizeAnswerData(formData, fields)).toEqual({});
  });
});

describe("normalizeAnswerData + denormalizeAnswerData (round-trip)", () => {
  it("round-trip préserve les données pour champ evaluation", () => {
    const original = {
      step1: { textField: "hello" },
      evaluationXYZ: { vote: 5 },
    };
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [
          makeField({ name: "textField", componentType: "text" }),
          makeField({ name: "evaluationXYZ", componentType: "evaluation" }),
        ],
        "step1",
      ),
    ];
    const normalized = normalizeAnswerData(original, fields) as Record<string, unknown>;
    const roundTripped = denormalizeAnswerData(normalized, fields);
    expect(roundTripped.evaluationXYZ).toEqual({ vote: 5 });
    const step1 = roundTripped.step1 as Record<string, unknown>;
    expect(step1.textField).toBe("hello");
  });
});

// ============================================================================
// extractFinderLinks
// ============================================================================

describe("extractFinderLinks", () => {
  it("retourne objet vide si aucun champ finder", () => {
    const formData = { step1: { f1: "text" } };
    const fields: SubFormFields[] = [
      makeSubFormFields([makeField({ name: "f1", componentType: "text" })], "step1"),
    ];
    expect(extractFinderLinks(formData, fields)).toEqual({});
  });

  it("extrait les éléments sélectionnés d'un finder", () => {
    const formData = {
      step1: {
        finderXYZ: {
          orgId1: { id: "orgId1", name: "Org A", type: "organizations" },
          userId1: { id: "userId1", name: "User B", type: "citoyens" },
        },
      },
    };
    const fields: SubFormFields[] = [
      makeSubFormFields([makeField({ name: "finderXYZ", componentType: "finder" })], "step1"),
    ];
    const links = extractFinderLinks(formData, fields);
    expect(links).toEqual({
      organizations: {
        orgId1: { name: "Org A", type: "organizations" },
      },
      citoyens: {
        userId1: { name: "User B", type: "citoyens" },
      },
    });
  });

  it("ignore les finder null", () => {
    const formData = { step1: { finderXYZ: null } };
    const fields: SubFormFields[] = [
      makeSubFormFields([makeField({ name: "finderXYZ", componentType: "finder" })], "step1"),
    ];
    expect(extractFinderLinks(formData, fields)).toEqual({});
  });

  it("agrège plusieurs éléments du même type sur plusieurs finders", () => {
    const formData = {
      step1: {
        finderA: { o1: { id: "o1", name: "A", type: "organizations" } },
      },
      step2: {
        finderB: { o2: { id: "o2", name: "B", type: "organizations" } },
      },
    };
    const fields: SubFormFields[] = [
      makeSubFormFields([makeField({ name: "finderA", componentType: "finder" })], "step1"),
      makeSubFormFields([makeField({ name: "finderB", componentType: "finder" })], "step2"),
    ];
    const links = extractFinderLinks(formData, fields);
    expect(links.organizations).toEqual({
      o1: { name: "A", type: "organizations" },
      o2: { name: "B", type: "organizations" },
    });
  });

  it("ignore les subForms absents dans formData", () => {
    const formData = {};
    const fields: SubFormFields[] = [
      makeSubFormFields([makeField({ name: "finderA", componentType: "finder" })], "step1"),
    ];
    expect(extractFinderLinks(formData, fields)).toEqual({});
  });
});
