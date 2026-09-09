import { describe, expect, it } from "vitest";
import {
  DIRECT_WRITE_RAW_KEYS,
  denormalizeAnswerData,
  extractFinderLinks,
  generateDefaultValues,
  generateZodSchema,
  getFieldNameWithPrefix,
  getOriginalFieldKey,
  hasFieldPrefix,
  isDirectWriteField,
  isRootLevelField,
  mapCoFormTypeToComponentType,
  getSharedFinderInfo,
  isTruthyFlag,
  normalizeAnswerData,
  omitHiddenSteps,
  parseCoFormFields,
  resolveInputOrder,
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
    _id: { _str: "form123" },
    id: "form123",
    name: "Test Form",
    created: 0,
    creator: "creator1",
    type: "form",
    inputs: {},
    ...overrides,
  };
}

/**
 * `access` complet tel que le renvoie `Coform::getFormAccessInfo`. Seul
 * `restrictedFields` nous intéresse ici, mais le type exige le reste.
 */
function makeAccess(restrictedFields: string[]): NonNullable<CoFormData["access"]> {
  return {
    canAnswer: true,
    reason: null,
    formStatus: "open",
    existingAnswerId: null,
    existingAnswer: null,
    requiresLogin: false,
    allowTemporary: false,
    withConfirmation: false,
    isOnlyMember: false,
    isOneAnswerPerPers: false,
    isActive: true,
    dates: { start: null, end: null, startNoConfirmation: null, endNoConfirmation: null },
    restrictedFields,
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

  it("mappe select (raccourci + chemin de template complet)", () => {
    expect(mapCoFormTypeToComponentType("select")).toBe("select");
    expect(mapCoFormTypeToComponentType("tpls.forms.select")).toBe("select");
  });

  it("mappe les types date/heure natifs sur text (input HTML typé)", () => {
    expect(mapCoFormTypeToComponentType("date")).toBe("text");
    expect(mapCoFormTypeToComponentType("time")).toBe("text");
    expect(mapCoFormTypeToComponentType("datetime-local")).toBe("text");
  });

  it("mappe timeSlots et dynamicFields", () => {
    expect(mapCoFormTypeToComponentType("tpls.forms.cplx.timeSlots")).toBe("timeSlots");
    expect(mapCoFormTypeToComponentType("tpls.forms.cplx.dynamicFields")).toBe("dynamicFields");
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

  it("extrait les options d'un select à liste plate (params[key].options)", () => {
    const formData = makeCoFormData({
      inputs: {
        step1: {
          name: "Step 1",
          id: "step1",
          formParent: "form123",
          inputs: { sel: { label: "Choix", type: "select", isRequired: true } },
        },
      },
      params: {
        sel: { options: ["Option A", "Option B", "Option C"] },
      },
    });

    const field = parseCoFormFields(formData)[0].fields[0];
    expect(field.componentType).toBe("select");
    expect(field.options).toEqual(["Option A", "Option B", "Option C"]);
    // Liste plate : value === label, pas de table de correspondance.
    expect(field.optionLabels).toBeUndefined();
  });

  it("extrait les options d'un select associatif (clé stockée + label affiché)", () => {
    const formData = makeCoFormData({
      inputs: {
        step1: {
          name: "Step 1",
          id: "step1",
          formParent: "form123",
          inputs: { cat: { label: "Catégorie", type: "select" } },
        },
      },
      params: {
        cat: { options: { val1: "Label 1", val2: "Label 2" } },
      },
    });

    const field = parseCoFormFields(formData)[0].fields[0];
    expect(field.componentType).toBe("select");
    // `options` porte les CLÉS (la valeur réellement stockée en réponse).
    expect(field.options).toEqual(["val1", "val2"]);
    // `optionLabels` donne la correspondance clé → label affiché.
    expect(field.optionLabels).toEqual({ val1: "Label 1", val2: "Label 2" });
  });

  it("simpleTable : parse le flag editInModal (bool ou string, défaut false)", () => {
    const parseEditInModal = (editInModal: boolean | string | undefined) =>
      parseCoFormFields(
        makeCoFormData({
          inputs: {
            step1: {
              name: "Step 1",
              id: "step1",
              formParent: "form123",
              inputs: { tbl: { label: "Tableau", type: "tpls.forms.cplx.simpleTable" } },
            },
          },
          params: {
            simpleTabletbl: {
              columns: [{ label: "Col1", type: "Text" }],
              rows: [{ label: "R1" }],
              activeNewLine: false,
              editInModal,
            },
          },
        }),
      )[0].fields[0].simpleTableConfig?.editInModal;

    expect(parseEditInModal(true)).toBe(true);
    expect(parseEditInModal("true")).toBe(true); // PHP stocke souvent les bools en string
    expect(parseEditInModal(false)).toBe(false);
    expect(parseEditInModal(undefined)).toBe(false); // absent → false
  });

  it("active searchable quand enableSelect2 est vrai (bool ou string)", () => {
    const makeSelect = (enableSelect2: unknown) =>
      parseCoFormFields(
        makeCoFormData({
          inputs: {
            step1: {
              name: "Step 1",
              id: "step1",
              formParent: "form123",
              inputs: { sel: { label: "Choix", type: "tpls.forms.select" } },
            },
          },
          params: { sel: { options: ["A", "B"], enableSelect2 } },
        })
      )[0].fields[0];

    expect(makeSelect(true).searchable).toBe(true);
    expect(makeSelect("true").searchable).toBe(true);
    expect(makeSelect("1").searchable).toBe(true);
    // Désactivé / absent → undefined (liste déroulante simple).
    expect(makeSelect(false).searchable).toBeUndefined();
    expect(makeSelect(undefined).searchable).toBeUndefined();
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

  it("dynamicFields → `minRows` lignes de sous-champs vides (pas [])", () => {
    // Source de vérité du semis : c'est ICI, et non un `onChange` au montage du
    // composant, sans quoi la baseline RHF (`[]`) diffère de la valeur affichée
    // et le formulaire naît `isDirty`.
    const result = generateDefaultValues([
      makeSubFormFields([
        makeField({
          name: "partenaires",
          componentType: "dynamicFields",
          isRequired: false,
          dynamicFieldsConfig: {
            enableMultipleRows: true,
            minRows: 1,
            maxRows: 2,
            fieldsConfig: [
              { key: "partnerName", label: "Nom du partenaire", type: "text", required: true },
              { key: "postalCode", label: "Code postal", type: "text" },
            ],
          },
        }),
      ]),
    ]);
    expect(result.partenaires).toEqual([{ partnerName: "", postalCode: "" }]);
  });

  it("dynamicFields requis avec minRows: 0 → 1 ligne quand même", () => {
    // `Math.max(isRequired ? 1 : 0, minRows)` — formule recopiée du composant.
    const result = generateDefaultValues([
      makeSubFormFields([
        makeField({
          name: "obligatoire",
          componentType: "dynamicFields",
          isRequired: true,
          dynamicFieldsConfig: {
            enableMultipleRows: true,
            minRows: 0,
            maxRows: 5,
            fieldsConfig: [{ key: "nom", label: "Nom", type: "text" }],
          },
        }),
      ]),
    ]);
    expect(result.obligatoire).toEqual([{ nom: "" }]);
  });

  it("dynamicFields sans config → []", () => {
    const result = generateDefaultValues([
      makeSubFormFields([makeField({ name: "vide", componentType: "dynamicFields" })]),
    ]);
    expect(result.vide).toEqual([]);
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
        editInModal: false,
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

  it("dynamicFields requis : des lignes vides ne suffisent pas", () => {
    // Le schéma ne filtre plus les lignes vides (le strip vit au save, seul
    // point traversé par les 3 chemins d'écriture) : le « requis » doit donc
    // compter les lignes RENSEIGNÉES, sans quoi le semis automatique de
    // `minRows` validerait à lui seul un champ obligatoire jamais rempli.
    const schema = generateZodSchema([
      makeSubFormFields([
        makeField({
          name: "partenaires",
          componentType: "dynamicFields",
          isRequired: true,
          dynamicFieldsConfig: {
            enableMultipleRows: true,
            minRows: 1,
            maxRows: 3,
            fieldsConfig: [{ key: "nom", label: "Nom", type: "text" }],
          },
        }),
      ]),
    ]);
    expect(() => schema.parse({ partenaires: [{ nom: "" }] })).toThrow();
    expect(() => schema.parse({ partenaires: [{ nom: "ADAPTE" }] })).not.toThrow();
  });

  it("dynamicFields NON requis reste soumissible avec des lignes vides", () => {
    // Régression connue : un dynamicFields non requis à sous-champs `required`
    // rendait le formulaire INSOUMISSIBLE, parce que les lignes semées
    // automatiquement échouaient aux règles par sous-champ.
    const schema = generateZodSchema([
      makeSubFormFields([
        makeField({
          name: "partenaires",
          componentType: "dynamicFields",
          isRequired: false,
          dynamicFieldsConfig: {
            enableMultipleRows: true,
            minRows: 1,
            maxRows: 3,
            fieldsConfig: [{ key: "nom", label: "Nom", type: "text", required: true }],
          },
        }),
      ]),
    ]);
    expect(() => schema.parse({ partenaires: [{ nom: "" }] })).not.toThrow();
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

  it("inputType url valide le format (tolérant, sans schéma) — requis", () => {
    const schema = generateZodSchema([
      makeSubFormFields([
        makeField({ name: "u", componentType: "text", inputType: "url", isRequired: true }),
      ]),
    ]);
    // URL sans schéma acceptée
    expect(schema.parse({ u: "laplumealoup.dokos.fr" })).toEqual({ u: "laplumealoup.dokos.fr" });
    // URL avec schéma + chemin/query acceptée
    expect(schema.parse({ u: "https://exemple.fr/path?q=1" })).toEqual({ u: "https://exemple.fr/path?q=1" });
    // chaîne non-URL rejetée
    expect(() => schema.parse({ u: "pas une url" })).toThrow();
    // requis + vide rejeté (par min(1))
    expect(() => schema.parse({ u: "" })).toThrow();
  });

  it("inputType url non requis : la validation ne s'applique PAS au champ vide", () => {
    const schema = generateZodSchema([
      makeSubFormFields([
        makeField({ name: "u", componentType: "text", inputType: "url", isRequired: false }),
      ]),
    ]);
    // non requis + vide → valide (pas de validation de format)
    expect(() => schema.parse({ u: "" })).not.toThrow();
    // non requis + URL sans schéma → valide
    expect(schema.parse({ u: "monsite.re" })).toEqual({ u: "monsite.re" });
    // non requis mais renseigné avec une non-URL → rejeté
    expect(() => schema.parse({ u: "nope" })).toThrow();
  });

  it("radio requis (avec options) : sélection vide → message traduit, pas le défaut Zod enum", () => {
    const schema = generateZodSchema([
      makeSubFormFields([
        makeField({ name: "r", label: "Choix", componentType: "radio", options: ["a", "b"], isRequired: true }),
      ]),
    ]);
    const res = schema.safeParse({ r: "" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.map((i) => i.message)).toContain("Choix est requis");
    }
    // valeur valide acceptée
    expect(schema.parse({ r: "a" })).toEqual({ r: "a" });
  });

  it("radio requis (sans options) : valeur vide → message traduit, pas le défaut Zod min", () => {
    const schema = generateZodSchema([
      makeSubFormFields([
        makeField({ name: "r2", label: "Libre", componentType: "radio", isRequired: true }),
      ]),
    ]);
    const res = schema.safeParse({ r2: "" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.map((i) => i.message)).toContain("Libre est requis");
    }
  });

  it("commonTable : note hors de [0,5] → message traduit, pas le défaut Zod min/max", () => {
    const schema = generateZodSchema([
      makeSubFormFields([
        makeField({ name: "ct", label: "Besoins", componentType: "commonTable", isRequired: false }),
      ]),
    ]);
    const composite = {
      scores: {
        c1: { criteriaId: "c1", criteria: "Outil", usage: "U", usageKey: "c1", note: 6, happiness: "", yesOrNo: false, comment: "" },
      },
      myCatalog: {},
    };
    const res = schema.safeParse({ ct: composite });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.map((i) => i.message)).toContain("La note doit être comprise entre 0 et 5");
    }
  });

  it("injecte le traducteur `t` pour les nouveaux messages Zod (radio enum + note)", () => {
    const calls: string[] = [];
    const t = (key: string, fallback?: string) => {
      calls.push(key);
      return fallback ?? "";
    };
    generateZodSchema(
      [
        makeSubFormFields([
          makeField({ name: "r", componentType: "radio", options: ["a"], isRequired: true }),
          makeField({ name: "ct", componentType: "commonTable", isRequired: false }),
        ]),
      ],
      t,
    );
    expect(calls).toContain("coform.validation.requiredField");
    expect(calls).toContain("coform.validation.noteRange");
  });

  // ── timeSlots ──
  // Slot de référence = format réel des answers SSBE.
  const validSlot = { day: "Monday", startHour: "08", startMinute: "00", endHour: "09", endMinute: "00" };

  it("timeSlots accepte le format réel SSBE et rejette fin <= début", () => {
    const schema = generateZodSchema([
      makeSubFormFields([makeField({ name: "ts", componentType: "timeSlots", isRequired: false })]),
    ]);
    expect(() => schema.parse({ ts: [validSlot] })).not.toThrow();
    expect(() => schema.parse({ ts: [{ ...validSlot, endHour: "07" }] })).toThrow();
  });

  it("timeSlots rejette un slot incomplet et timeSlots required exige >= 1 slot", () => {
    const schema = generateZodSchema([
      makeSubFormFields([makeField({ name: "ts", componentType: "timeSlots", isRequired: true })]),
    ]);
    expect(() => schema.parse({ ts: [] })).toThrow();
    expect(() => schema.parse({ ts: [{ ...validSlot, day: "" }] })).toThrow();
    expect(() => schema.parse({ ts: [validSlot] })).not.toThrow();
  });

  // ── dynamicFields ──
  const dynField = makeField({
    name: "df",
    componentType: "dynamicFields",
    dynamicFieldsConfig: {
      enableMultipleRows: true,
      minRows: 1,
      maxRows: 10,
      fieldsConfig: [
        { key: "partnerName", label: "Nom", type: "text", required: true, validation: { minLength: 2, maxLength: 10 } },
        { key: "role", label: "Rôle", type: "text", required: false },
      ],
    },
  });

  it("dynamicFields valide required/minLength/maxLength des sous-champs", () => {
    const schema = generateZodSchema([makeSubFormFields([{ ...dynField, isRequired: false }])]);
    expect(() => schema.parse({ df: [{ partnerName: "ADAPTE", role: "" }] })).not.toThrow();
    expect(() => schema.parse({ df: [{ partnerName: "", role: "x" }] })).toThrow(); // required vide
    expect(() => schema.parse({ df: [{ partnerName: "A", role: "" }] })).toThrow(); // < minLength
    expect(() => schema.parse({ df: [{ partnerName: "ABCDEFGHIJK", role: "" }] })).toThrow(); // > maxLength
  });

  it("dynamicFields required exige minRows lignes", () => {
    const schema = generateZodSchema([makeSubFormFields([{ ...dynField, isRequired: true }])]);
    expect(() => schema.parse({ df: [] })).toThrow();
    expect(() => schema.parse({ df: [{ partnerName: "ADAPTE", role: "" }] })).not.toThrow();
  });
});

// ============================================================================
// normalizeAnswerData
// ============================================================================

describe("tags et titleSeparator (port des inputs legacy)", () => {
  // Fixtures issues du formulaire réel « Les communs des CAEs »
  // `677e7e389058e31575550ac8` (base `pixelhumain1`, 2026-08-19).
  const formCae = () =>
    makeCoFormData({
      params: {
        // Vocabulaire partagé réellement présent sur ce formulaire (extrait).
        tags: { list: ["Commun", "coopération", "peertube", "  ", "opensource"] },
      },
      inputs: {
        aapStep1: {
          name: "Le commun",
          id: "aapStep1",
          formParent: "677e7e389058e31575550ac8",
          inputs: {
            tags: {
              label: "Tags",
              type: "tpls.forms.tags",
              placeholder: "Ajoutez les tags qui facilitent l'identification du commun",
              isRequired: false,
            },
            aapStep1m0dia6b7r0panzlwqvk: {
              label: "Le commun",
              type: "tpls.forms.titleSeparator",
              // Tel quel en base sur 57 des 78 séparateurs du parc.
              isRequired: true,
            },
          },
        },
      },
    } as unknown as Partial<CoFormData>);

  it("mappe les deux types legacy vers leurs composants", () => {
    expect(mapCoFormTypeToComponentType("tpls.forms.tags")).toBe("tags");
    expect(mapCoFormTypeToComponentType("tpls.forms.titleSeparator")).toBe("titleSeparator");
  });

  it("extrait le vocabulaire partagé depuis `params.<key>.list`, nettoyé", () => {
    const [step] = parseCoFormFields(formCae());
    const tags = step.fields.find((f) => f.name === "tags");
    expect(tags?.componentType).toBe("tags");
    // Les entrées vides sont retirées, l'ordre et la casse préservés.
    expect(tags?.tagsConfig?.list).toEqual(["Commun", "coopération", "peertube", "opensource"]);
  });

  it("donne un vocabulaire vide (et non `undefined`) quand `params` n'en a pas", () => {
    // 84 des 124 inputs `tags` du parc sont dans ce cas — ils basculent alors
    // sur l'index global, ce que le hook décide sur `list.length === 0`.
    const data = formCae();
    (data as unknown as { params?: unknown }).params = {};
    const [step] = parseCoFormFields(data);
    expect(step.fields.find((f) => f.name === "tags")?.tagsConfig?.list).toEqual([]);
  });

  it("n'attribue AUCUNE valeur par défaut au séparateur", () => {
    const defaults = generateDefaultValues([
      makeSubFormFields([
        makeField({ name: "sep", componentType: "titleSeparator", isRequired: true }),
        makeField({ name: "tags", componentType: "tags" }),
      ]),
    ]);
    expect("sep" in defaults).toBe(false);
    expect(defaults.tags).toEqual([]);
  });

  it("laisse le séparateur HORS du schéma Zod, même marqué requis", () => {
    // Le point dur : `isRequired: true` est posé sur un input qui ne produit
    // aucune valeur. L'honorer rendrait les formulaires concernés
    // insoumettables — un formulaire vide doit rester valide.
    const schema = generateZodSchema([
      makeSubFormFields([
        makeField({ name: "sep", componentType: "titleSeparator", isRequired: true, label: "Le commun" }),
      ]),
    ]);
    expect(schema.safeParse({}).success).toBe(true);
    // Et la clé est strippée si elle traîne dans les données.
    const parsed = schema.safeParse({ sep: "valeur parasite" });
    expect(parsed.success).toBe(true);
    expect("sep" in (parsed.data as object)).toBe(false);
  });

  it("valide les réponses `tags` réellement en base (round-trip safeParse)", () => {
    const schema = generateZodSchema([
      makeSubFormFields([makeField({ name: "tags", componentType: "tags", label: "Tags" })]),
    ]);
    // Les 2 seules réponses enregistrées sur le formulaire CAE.
    for (const reelle of [["open source"], ["peertube"]]) {
      const parsed = schema.safeParse({ tags: reelle });
      expect(parsed.success).toBe(true);
      expect((parsed.data as { tags: string[] }).tags).toEqual(reelle);
    }
    // Champ non requis laissé vide.
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ tags: [] }).success).toBe(true);
  });

  it("refuse un `tags` requis laissé vide", () => {
    const schema = generateZodSchema([
      makeSubFormFields([
        makeField({ name: "tags", componentType: "tags", isRequired: true, label: "Tags" }),
      ]),
    ]);
    expect(schema.safeParse({ tags: [] }).success).toBe(false);
    expect(schema.safeParse({ tags: ["a"] }).success).toBe(true);
  });

  it("coerce un `{}` serveur en tableau vide pour un champ tags", () => {
    // `getFieldShape("tags") === "array"` : sans ça la valeur `{}` que PHP
    // sérialise pour un tableau vide ferait échouer le parse Zod.
    const fields = [makeSubFormFields([makeField({ name: "tags", componentType: "tags" })])];
    const normalized = normalizeAnswerData({ step1: { tags: {} } } as never, fields) as Record<
      string,
      Record<string, unknown>
    >;
    expect(normalized.step1.tags).toEqual([]);
  });
});

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

  it("coerce un coeff legacy stocké en string vers un number (myCatalog commonTable)", () => {
    // Reproduction du bug "format invalide" : le legacy commonTableV2 stocke le
    // coefficient via un input texte → `coeff:"1"` (string) casse `z.number()`
    // au submit. commonTable est nommé `yesOrNo{key}` et split sur deux clés
    // root-level : `yesOrNo{key}` (scores) + `criterias{key}` (myCatalog).
    const raw = {
      yesOrNotest1: {},
      criteriastest1: {
        criteria123: { usage: "Bureautique", usageKey: "criteria123", coeff: "1", label: "" },
      },
    };
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [makeField({ name: "yesOrNotest1", label: "Besoins", componentType: "commonTable" })],
        "step1",
      ),
    ];
    const result = normalizeAnswerData(raw, fields) as Record<string, unknown>;
    const composite = (result.step1 as Record<string, unknown>).yesOrNotest1 as {
      scores: Record<string, unknown>;
      myCatalog: Record<string, { coeff: unknown }>;
    };
    expect(composite.myCatalog.criteria123.coeff).toBe(1);

    // La valeur enrichie passe désormais la validation Zod du submit
    // (avant le fix : `coeff:"1"` → invalid_type → submit bloqué).
    const schema = generateZodSchema(fields);
    expect(schema.safeParse({ yesOrNotest1: composite }).success).toBe(true);
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

describe("denormalizeAnswerData — lignes vides dynamicFields", () => {
  const CHAMP = makeField({
    name: "partenaires",
    componentType: "dynamicFields",
    dynamicFieldsConfig: {
      enableMultipleRows: true,
      minRows: 1,
      maxRows: 3,
      fieldsConfig: [
        { key: "partnerName", label: "Nom", type: "text" },
        { key: "postalCode", label: "CP", type: "text" },
      ],
    },
  });
  const FIELDS: SubFormFields[] = [makeSubFormFields([CHAMP], "step1")];

  it("ne persiste pas les lignes entièrement vides", () => {
    // Ces lignes viennent des valeurs par défaut (`minRows`) et ne sont pas
    // supprimables à la main : sans ce strip, chaque save écrit
    // `{"partnerName":"","postalCode":""}` en base.
    const data = {
      step1: {
        partenaires: [
          { partnerName: "ADAPTETONSPORT", postalCode: "97430" },
          { partnerName: "", postalCode: "" },
        ],
      },
    };
    const out = denormalizeAnswerData(data, FIELDS);
    expect((out.step1 as Record<string, unknown>).partenaires).toEqual([
      { partnerName: "ADAPTETONSPORT", postalCode: "97430" },
    ]);
  });

  it("garde les lignes partiellement remplies", () => {
    // Une saisie en cours n'est pas un déchet : seule la ligne ENTIÈREMENT
    // vide est du remplissage automatique.
    const data = { step1: { partenaires: [{ partnerName: "ADAPTE", postalCode: "" }] } };
    const out = denormalizeAnswerData(data, FIELDS);
    expect((out.step1 as Record<string, unknown>).partenaires).toEqual([
      { partnerName: "ADAPTE", postalCode: "" },
    ]);
  });

  it("rend une réponse legacy conforme au schéma Zod (pas seulement complète)", () => {
    // Norme d'enrichissement : produire un shape ENTIÈREMENT conforme, pas
    // seulement complet. Sans coercion, `postalCode: 97430` fait échouer
    // `form.trigger()` à l'ouverture de l'étape, avec une issue Zod imbriquée
    // (`path: ["partenaires", 0, "postalCode"]`) qu'`ErrorSummary` n'affiche
    // pas : l'utilisateur reste bloqué sans savoir quoi corriger.
    const champ = makeField({
      name: "partenaires",
      componentType: "dynamicFields",
      dynamicFieldsConfig: {
        enableMultipleRows: true,
        minRows: 1,
        maxRows: 3,
        fieldsConfig: [
          { key: "partnerName", label: "Nom", type: "text" },
          { key: "postalCode", label: "CP", type: "text" },
        ],
      },
    });
    const fields: SubFormFields[] = [makeSubFormFields([champ], "step1")];
    const enrichi = normalizeAnswerData(
      { step1: { partenaires: [{ partnerName: "ADAPTE", postalCode: 97430 }, null] } },
      fields,
    )!.step1 as Record<string, unknown>;

    expect(enrichi.partenaires).toEqual([
      { partnerName: "ADAPTE", postalCode: "97430" },
    ]);
    expect(generateZodSchema(fields).safeParse(enrichi).success).toBe(true);
  });

  it("ne plante pas sur une ligne legacy à cellules non-string", () => {
    // Le prédicat tourne ici sur la donnée BRUTE du serveur, sans parse Zod en
    // amont : une réponse legacy portant un nombre (ou une ligne `null`) ferait
    // échouer `denormalizeAnswerData` en entier — enregistrement impossible sur
    // une réponse qui s'enregistrait avant. Le court-circuit de `.every()`
    // masque le cas dès qu'une première cellule est remplie : c'est donc la
    // ligne SEMÉE (cellules vides d'abord) qui déclenchait le crash.
    const data = {
      step1: { partenaires: [{ partnerName: "", postalCode: 97430 }, null, { partnerName: "", postalCode: "" }] },
    };
    expect(() => denormalizeAnswerData(data, FIELDS)).not.toThrow();
    expect((denormalizeAnswerData(data, FIELDS).step1 as Record<string, unknown>).partenaires).toEqual([
      { partnerName: "", postalCode: 97430 },
    ]);
  });

  it("traite les espaces seuls comme du vide", () => {
    const data = { step1: { partenaires: [{ partnerName: "   ", postalCode: "" }] } };
    const out = denormalizeAnswerData(data, FIELDS);
    expect((out.step1 as Record<string, unknown>).partenaires).toEqual([]);
  });
});

describe("normalizeAnswerData — recomplètement dynamicFields", () => {
  function champ(minRows: number, isRequired = false) {
    return makeField({
      name: "partenaires",
      componentType: "dynamicFields",
      isRequired,
      dynamicFieldsConfig: {
        enableMultipleRows: true,
        minRows,
        maxRows: 5,
        fieldsConfig: [
          { key: "partnerName", label: "Nom", type: "text" },
          { key: "postalCode", label: "CP", type: "text" },
        ],
      },
    });
  }

  it("rouvre une réponse vide avec ses `minRows` lignes", () => {
    // Une réponse enregistrée sans ligne remplie est persistée `[]` : sans
    // recomplètement, sa réouverture n'afficherait aucune ligne à remplir.
    const fields: SubFormFields[] = [makeSubFormFields([champ(1)], "step1")];
    const out = normalizeAnswerData({ step1: { partenaires: [] } }, fields)!;
    expect((out.step1 as Record<string, unknown>).partenaires).toEqual([
      { partnerName: "", postalCode: "" },
    ]);
  });

  it("complète jusqu'à `minRows` sans toucher aux lignes remplies", () => {
    const fields: SubFormFields[] = [makeSubFormFields([champ(2)], "step1")];
    const out = normalizeAnswerData(
      { step1: { partenaires: [{ partnerName: "ADAPTE", postalCode: "97430" }] } },
      fields,
    )!;
    expect((out.step1 as Record<string, unknown>).partenaires).toEqual([
      { partnerName: "ADAPTE", postalCode: "97430" },
      { partnerName: "", postalCode: "" },
    ]);
  });

  it("ne retire jamais de lignes au-delà de `minRows`", () => {
    const fields: SubFormFields[] = [makeSubFormFields([champ(1)], "step1")];
    const rows = [
      { partnerName: "A", postalCode: "1" },
      { partnerName: "B", postalCode: "2" },
    ];
    const out = normalizeAnswerData({ step1: { partenaires: rows } }, fields)!;
    expect((out.step1 as Record<string, unknown>).partenaires).toEqual(rows);
  });

  it("champ requis à minRows 0 → une ligne quand même", () => {
    const fields: SubFormFields[] = [makeSubFormFields([champ(0, true)], "step1")];
    const out = normalizeAnswerData({ step1: { partenaires: [] } }, fields)!;
    expect((out.step1 as Record<string, unknown>).partenaires).toHaveLength(1);
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
// Multi-eval (radioNew + activeMultieval=true) — storage `_multiEval.{userId}`
// ============================================================================

describe("normalizeAnswerData (multi-eval)", () => {
  const multiEvalFields: SubFormFields[] = [
    makeSubFormFields(
      [
        makeField({
          name: "multiEvalQ1",
          componentType: "radio",
          activeMultieval: true,
          options: ["Pas du tout", "Un peu", "Beaucoup"],
        }),
      ],
      "step1",
    ),
  ];

  it("pré-remplit la contribution de l'user courant via `value` canonical", () => {
    const raw = {
      step1: {
        multiEvalQ1_multiEval: {
          user123: { value: "Beaucoup", date: "2026-06-15T00:00:00.000Z", answer: "2_beaucoup" },
          user456: { value: "Un peu", date: "2026-06-15T00:00:00.000Z", answer: "1_un-peu" },
        },
      },
    };
    const result = normalizeAnswerData(raw, multiEvalFields, "user123") as Record<string, unknown>;
    expect((result.step1 as Record<string, unknown>).multiEvalQ1).toBe("Beaucoup");
  });

  it("fallback sur le parsing legacy `{idx}_{slug}` quand `value` absent", () => {
    const raw = {
      step1: {
        multiEvalQ1_multiEval: {
          user123: { answer: "1_un-peu" }, // pas de `value`
        },
      },
    };
    const result = normalizeAnswerData(raw, multiEvalFields, "user123") as Record<string, unknown>;
    expect((result.step1 as Record<string, unknown>).multiEvalQ1).toBe("Un peu");
  });

  it("ignore la contribution d'un AUTRE user (reste vide si pas de contribution propre)", () => {
    const raw = {
      step1: {
        multiEvalQ1_multiEval: {
          user456: { value: "Un peu", date: "x", answer: "1_un-peu" },
        },
      },
    };
    const result = normalizeAnswerData(raw, multiEvalFields, "user123") as Record<string, unknown>;
    expect((result.step1 as Record<string, unknown>).multiEvalQ1).toBeUndefined();
  });

  it("efface toujours la valeur classique (résidu legacy) même sans userId", () => {
    const raw = {
      step1: {
        multiEvalQ1: "Beaucoup", // valeur classique parasite
        multiEvalQ1_multiEval: { user123: { value: "Beaucoup", date: "x", answer: "2_beaucoup" } },
      },
    };
    const result = normalizeAnswerData(raw, multiEvalFields, null) as Record<string, unknown>;
    expect((result.step1 as Record<string, unknown>).multiEvalQ1).toBeUndefined();
  });

  it("ignore une `value` qui n'est plus dans les options (option supprimée)", () => {
    const raw = {
      step1: {
        multiEvalQ1_multiEval: { user123: { value: "OptionDisparue", answer: "9_optiondisparue" } },
      },
    };
    const result = normalizeAnswerData(raw, multiEvalFields, "user123") as Record<string, unknown>;
    // value hors options + idx 9 hors range → pas de résolution
    expect((result.step1 as Record<string, unknown>).multiEvalQ1).toBeUndefined();
  });

  it("tolère un `_multiEval` sérialisé `[]` par Mongo (objet vide) sans crash", () => {
    // MongoDB sérialise indifféremment `{}` et `[]` : la garde `!Array.isArray`
    // doit rejeter l'array et laisser le champ vide (pas de throw).
    const raw = { step1: { multiEvalQ1_multiEval: [] } };
    const result = normalizeAnswerData(raw, multiEvalFields, "user123") as Record<string, unknown>;
    expect((result.step1 as Record<string, unknown>).multiEvalQ1).toBeUndefined();
  });
});

describe("denormalizeAnswerData (multi-eval)", () => {
  const multiEvalFields: SubFormFields[] = [
    makeSubFormFields(
      [
        makeField({
          name: "multiEvalQ1",
          componentType: "radio",
          activeMultieval: true,
          options: ["Pas du tout", "Un peu", "Beaucoup"],
        }),
      ],
      "step1",
    ),
  ];

  it("packe la valeur de l'user courant dans `{name}_multiEval.{userId}` + retire la classique", () => {
    const formData = { step1: { multiEvalQ1: "Beaucoup" } };
    const result = denormalizeAnswerData(formData, multiEvalFields, "user123");
    const step1 = result.step1 as Record<string, unknown>;
    expect(step1.multiEvalQ1).toBeUndefined();
    const record = step1.multiEvalQ1_multiEval as Record<string, { value: unknown; answer: unknown; date: unknown }>;
    expect(Object.keys(record)).toEqual(["user123"]); // QUE l'entrée du user courant
    expect(record.user123.value).toBe("Beaucoup");
    expect(record.user123.answer).toBe("2_beaucoup");
    // Sentinel legacy "now" : le backend (Coform::coerceAnswerDates) le
    // convertit en MongoDate. On ne stamp PAS côté client (déterminisme + autorité serveur).
    expect(record.user123.date).toBe("now");
  });

  it("sans userId : laisse la valeur classique intacte (pas de pack multi-eval)", () => {
    const formData = { step1: { multiEvalQ1: "Beaucoup" } };
    const result = denormalizeAnswerData(formData, multiEvalFields, null);
    const step1 = result.step1 as Record<string, unknown>;
    expect(step1.multiEvalQ1).toBe("Beaucoup");
    expect(step1.multiEvalQ1_multiEval).toBeUndefined();
  });

  it("valeur vide : retire la classique sans créer d'entrée multi-eval", () => {
    const formData = { step1: { multiEvalQ1: "" } };
    const result = denormalizeAnswerData(formData, multiEvalFields, "user123");
    const step1 = result.step1 as Record<string, unknown>;
    expect(step1.multiEvalQ1).toBeUndefined();
    expect(step1.multiEvalQ1_multiEval).toBeUndefined();
  });
});

describe("multi-eval round-trip (write puis read, même user)", () => {
  const multiEvalFields: SubFormFields[] = [
    makeSubFormFields(
      [
        makeField({
          name: "multiEvalQ1",
          componentType: "radio",
          activeMultieval: true,
          options: ["Pas du tout", "Un peu", "Beaucoup"],
        }),
      ],
      "step1",
    ),
  ];

  it("write(user123) → read(user123) restitue la valeur", () => {
    const written = denormalizeAnswerData({ step1: { multiEvalQ1: "Un peu" } }, multiEvalFields, "user123");
    const read = normalizeAnswerData(written, multiEvalFields, "user123") as Record<string, unknown>;
    expect((read.step1 as Record<string, unknown>).multiEvalQ1).toBe("Un peu");
  });

  it("write(user123) → read(user456) NE restitue PAS la valeur (isolement par user)", () => {
    const written = denormalizeAnswerData({ step1: { multiEvalQ1: "Un peu" } }, multiEvalFields, "user123");
    const read = normalizeAnswerData(written, multiEvalFields, "user456") as Record<string, unknown>;
    expect((read.step1 as Record<string, unknown>).multiEvalQ1).toBeUndefined();
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

// ============================================================================
// Finder : l'image n'est jamais persistée ni lue depuis la réponse
// (résolue live à l'affichage, cf. useFinderElementImages). Strip des 2 côtés.
// ============================================================================

describe("finder image stripping (normalize + denormalize)", () => {
  const finderFields: SubFormFields[] = [
    makeSubFormFields([makeField({ name: "finderXYZ", componentType: "finder" })], "step1"),
  ];

  it("denormalizeAnswerData retire `img` des éléments finder (pas de persistance)", () => {
    const formData = {
      step1: {
        finderXYZ: {
          o1: { id: "o1", name: "Org A", type: "organizations", img: "/upload/a.jpg" },
        },
      },
    };
    const result = denormalizeAnswerData(formData, finderFields) as {
      step1: { finderXYZ: Record<string, Record<string, unknown>> };
    };
    expect(result.step1.finderXYZ.o1).toEqual({ id: "o1", name: "Org A", type: "organizations" });
    expect("img" in result.step1.finderXYZ.o1).toBe(false);
  });

  it("normalizeAnswerData retire une `img` héritée d'une réponse ancienne", () => {
    const raw = {
      step1: {
        finderXYZ: {
          o1: {
            id: "o1",
            name: "Org A",
            type: "organizations",
            img: "/upload/stale.jpg",
            address: { postalCode: "97436" },
          },
        },
      },
    };
    const result = normalizeAnswerData(raw, finderFields) as {
      step1: { finderXYZ: Record<string, Record<string, unknown>> };
    };
    const el = result.step1.finderXYZ.o1;
    expect("img" in el).toBe(false);
    // les autres champs (dont address, donnée réelle) sont préservés.
    expect(el).toEqual({
      id: "o1",
      name: "Org A",
      type: "organizations",
      address: { postalCode: "97436" },
    });
  });

  it("ne casse pas un finder null / vide", () => {
    expect(
      (denormalizeAnswerData({ step1: { finderXYZ: null } }, finderFields) as { step1: Record<string, unknown> })
        .step1.finderXYZ,
    ).toBeNull();
  });
});

/**
 * Régression : un formulaire VIERGE affichait « Invalid input: expected object,
 * received string » sous le champ, avant toute saisie.
 *
 * Cause : `categorizedCheckbox` n'avait aucun cas dans `generateDefaultValues`
 * et tombait sur le `default` qui pose `""`, alors que son schéma attend
 * `{ list, sublist }`. Le `.optional()` ne rattrape pas — `""` n'est pas
 * `undefined` — et un champ requis n'a même pas d'`optional`.
 *
 * Le test exerce la chaîne réellement cassée (norme 11) : défauts → `safeParse`.
 */
describe("categorizedCheckbox — défaut compatible avec son schéma", () => {
  const champ = (isRequired: boolean) =>
    makeField({
      name: "besoins",
      label: "À quels besoins répond le commun ?",
      type: "tpls.forms.cplx.categorizedCheckbox",
      componentType: "categorizedCheckbox",
      isRequired,
    });

  it("pose `{ list: [], sublist: {} }`, pas une chaîne", () => {
    const valeurs = generateDefaultValues([makeSubFormFields([champ(false)])]);
    expect(valeurs.besoins).toEqual({ list: [], sublist: {} });
  });

  it("le défaut passe le schéma quand le champ est FACULTATIF", () => {
    const fields = [makeSubFormFields([champ(false)])];
    const res = generateZodSchema(fields).safeParse(generateDefaultValues(fields));
    expect(res.success).toBe(true);
  });

  it("un champ REQUIS échoue sur « requis », pas sur un conflit de type", () => {
    // Le formulaire vierge doit bien réclamer une réponse — mais avec le message
    // de champ obligatoire, pas « expected object, received string ».
    const fields = [makeSubFormFields([champ(true)])];
    const res = generateZodSchema(fields).safeParse(generateDefaultValues(fields));
    expect(res.success).toBe(false);
    const message = res.success ? "" : res.error.issues[0].message;
    expect(message).not.toMatch(/expected object/i);
  });

  it("une valeur saisie reste valide, `sublist` comprise", () => {
    const fields = [makeSubFormFields([champ(true)])];
    const res = generateZodSchema(fields).safeParse({
      besoins: { list: ["4_autres-outils"], sublist: { "4_autres-outils": ["0_gestion"] } },
    });
    expect(res.success).toBe(true);
  });
});

/**
 * L'indirection `multiDecide` est testée unitairement dans `multiDecide.test.ts`.
 * Ici on vérifie qu'elle s'applique RÉELLEMENT au parsing — c'est ce chemin-là
 * qui décide de la clé sous laquelle la réponse est lue et écrite, et un helper
 * juste mais jamais branché ne servirait à rien.
 *
 * Relevé en base : 266 inputs `multiDecide`, et AUCUNE réponse ne porte la clé
 * d'origine (`decide` : 0). Les clés réelles sont celles d'après substitution.
 */
describe("parseCoFormFields — résolution de multiDecide", () => {
  const formAvec = (multiDecide?: string) =>
    makeCoFormData({
      inputConfig: multiDecide ? { multiDecide } : undefined,
      inputs: {
        aapStep2: {
          id: "aapStep2",
          name: "Évaluation",
          formParent: "form123",
          inputs: {
            // Cas réel : clé `decide`, libellé « Dépenses », type placeholder.
            decide: { type: "tpls.forms.ocecoform.multiDecide", label: "Dépenses" },
          },
        },
      },
    });

  it("substitue le type ET RÉINDEXE le champ sous la clé du type cible", () => {
    const [etape] = parseCoFormFields(formAvec("tpls.forms.aap.selection"));
    expect(etape.fields).toHaveLength(1);
    expect(etape.fields[0]).toMatchObject({
      name: "selection", // ← pas `decide` : c'est là que tout se joue
      componentType: "selection",
      type: "tpls.forms.aap.selection",
      label: "Dépenses",
    });
  });

  it("résout aussi vers pourContre", () => {
    const [etape] = parseCoFormFields(formAvec("tpls.forms.ocecoform.pourContre"));
    expect(etape.fields[0]).toMatchObject({ name: "pourContre", componentType: "pourContre" });
  });

  it("SANS config : le champ n'est pas rendu du tout", () => {
    // Parité legacy : `multiDecide.php` n'affiche qu'un <select> réservé à
    // l'admin du formulaire. Un répondant ne doit rien voir — surtout pas le
    // bandeau « template introuvable ». 130 formulaires sont dans ce cas.
    const [etape] = parseCoFormFields(formAvec(undefined));
    expect(etape.fields).toHaveLength(0);
  });

  it("un type custom de costum est résolu comme les autres", () => {
    // Présent une fois en base.
    const [etape] = parseCoFormFields(
      formAvec("custom.fondationTerritorialeDesLumieres.selection")
    );
    expect(etape.fields[0].name).toBe("selection");
  });

  it("n'affecte pas les inputs ordinaires du même formulaire", () => {
    const data = makeCoFormData({
      inputConfig: { multiDecide: "tpls.forms.aap.selection" },
      inputs: {
        aapStep2: {
          id: "aapStep2",
          name: "Évaluation",
          formParent: "form123",
          inputs: {
            decide: { type: "tpls.forms.ocecoform.multiDecide", label: "Dépenses" },
            commentaire: { type: "tpls.forms.textarea", label: "Commentaire" },
          },
        },
      },
    });
    const [etape] = parseCoFormFields(data);
    expect(etape.fields.map((f) => f.name).sort()).toEqual(["commentaire", "selection"]);
  });
});

/**
 * `selection` et `pourContre` ne doivent JAMAIS transiter par le formulaire :
 * leur valeur est indexée par évaluateur et le backend remplace la clé en bloc
 * (`SaveAnswerAction:214` ne deep-merge que les clés `_multiEval`). Une entrée
 * au schéma ou aux valeurs par défaut suffirait à effacer, à chaque
 * enregistrement, les notes de tous les autres évaluateurs.
 */
describe("selection / pourContre — jamais soumis", () => {
  const champEval = (componentType: "selection" | "pourContre") =>
    makeSubFormFields([
      makeField({
        name: componentType,
        label: "Évaluation",
        type: `tpls.forms.aap.${componentType}`,
        componentType,
        isRequired: true, // même requis, aucune entrée ne doit apparaître
      }),
    ]);

  for (const ct of ["selection", "pourContre"] as const) {
    it(`\`${ct}\` n'entre pas dans les valeurs par défaut`, () => {
      const valeurs = generateDefaultValues([champEval(ct)]);
      expect(ct in valeurs).toBe(false);
    });

    it(`\`${ct}\` n'entre pas dans le schéma — une valeur parasite est STRIPPÉE`, () => {
      const res = generateZodSchema([champEval(ct)]).safeParse({
        [ct]: { autreEvaluateur: { critere: 5 } },
      });
      expect(res.success).toBe(true);
      // `z.object` strippe ce qui n'est pas déclaré : la clé ne repart pas au
      // serveur, donc les notes des autres évaluateurs survivent.
      expect(res.success && ct in (res.data as Record<string, unknown>)).toBe(false);
    });
  }
});

/**
 * Clés d'écriture directe — JAMAIS soumises, quel que soit le chemin.
 *
 * L'absence au schéma Zod (ci-dessus) ne protège que le bouton mono-étape :
 * le wizard (`submitAllData`) et l'autosave soumettent `getValues()` brut, et
 * la valeur y entre par les RÉPONSES SERVEUR (`normalizeAnswerData` recopie
 * `answers.<étape>` en bloc), pas par les défauts générés. Le point unique
 * traversé par les trois chemins est `denormalizeAnswerData` : c'est lui qui
 * doit stripper, sinon un « Enregistrer » du jury ré-émet un instantané périmé
 * de `selection` et efface les notes posées entre-temps par les autres.
 */
describe("denormalizeAnswerData — clés d'écriture directe jamais soumises", () => {
  // Formulaire AAP réel : dépôt (aapStep1) + jury (aapStep2) portant les quatre
  // inputs de décision, dont `selection` via l'indirection `multiDecide`.
  function makeParcoursJury(): CoFormData {
    return makeCoFormData({
      inputConfig: { multiDecide: "tpls.forms.aap.selection" },
      inputs: {
        aapStep1: {
          id: "aapStep1",
          name: "Dépôt",
          formParent: "form123",
          inputs: { titre: { type: "text", label: "Titre", placeholder: "" } },
        },
        aapStep2: {
          id: "aapStep2",
          name: "Jury",
          formParent: "form123",
          inputs: {
            commentaire: { type: "text", label: "Commentaire", placeholder: "" },
            decide: { type: "tpls.forms.ocecoform.multiDecide", label: "Sélection" },
            pourContre: { type: "tpls.forms.ocecoform.pourContre", label: "Vote" },
            evaluation: { type: "tpls.forms.aap.evaluation", label: "Évaluation" },
            choose: { type: "tpls.forms.aap.chooseProposal", label: "Choix" },
          },
        },
      },
    });
  }

  // Ce qu'on lit en base à l'ouverture : userB a déjà noté, voté, choisi.
  const REPONSES_SERVEUR = {
    aapStep1: { titre: "Mon commun" },
    aapStep2: {
      commentaire: "ok",
      selection: { userB: { c1: 4 } },
      admissibility: { userB: true },
      admissibilityTime: { userB: "2026-01-01" },
      pourContre: { userB: "pour" },
      evaluation: { userB: { 0: { note: 3 } } },
      choose: { ctx1: { value: "selected" } },
    },
  };

  it("le parse porte bien les quatre types d'écriture directe sur aapStep2", () => {
    const fields = parseCoFormFields(makeParcoursJury());
    const jury = fields.find((s) => s.subFormId === "aapStep2")!;
    expect(jury.fields.map((f) => [f.name, f.componentType]).sort()).toEqual([
      ["choose", "chooseProposal"],
      ["commentaire", "text"],
      ["evaluation", "aapEvaluation"],
      ["pourContre", "pourContre"],
      ["selection", "selection"],
    ]);
    for (const ct of ["selection", "pourContre", "aapEvaluation", "chooseProposal"] as const) {
      expect(isDirectWriteField(ct)).toBe(true);
    }
    expect(isDirectWriteField("text")).toBe(false);
  });

  it("strippe les clés même quand la valeur vient des réponses serveur (chemin wizard)", () => {
    const fields = parseCoFormFields(makeParcoursJury());
    // Exactement ce que le wizard soumet : les réponses normalisées, relues
    // telles quelles depuis `stepState.stepsData` (aucun passage par Zod).
    const stepsData = normalizeAnswerData(REPONSES_SERVEUR, fields, "userA") as Record<string, unknown>;
    // Sanity : la valeur est bien ENTRÉE par ce chemin — c'est ce que les
    // champs lisent pour s'afficher, on ne la retire pas de la lecture.
    expect((stepsData.aapStep2 as Record<string, unknown>).selection).toEqual({ userB: { c1: 4 } });

    const payload = denormalizeAnswerData(stepsData, fields, "userA");
    const jury = payload.aapStep2 as Record<string, unknown>;
    for (const cle of DIRECT_WRITE_RAW_KEYS) {
      expect(jury, `\`${cle}\` ne doit jamais repartir au serveur`).not.toHaveProperty(cle);
    }
    // Les champs ordinaires de la même étape, eux, partent normalement.
    expect(jury.commentaire).toBe("ok");
    expect(payload.aapStep1).toEqual({ titre: "Mon commun" });
  });

  it("strippe sur le chemin mono-étape / autosave (`{ [subFormId]: getValues() }`)", () => {
    const fields = parseCoFormFields(makeParcoursJury());
    const jury = fields.find((s) => s.subFormId === "aapStep2")!;
    // `SmartCoForm.onSubmit` enveloppe la sortie de `getValues()` sous l'id
    // d'étape — l'autosave y arrive sans validation Zod, donc avec `selection`.
    const brut = { aapStep2: { ...REPONSES_SERVEUR.aapStep2 } };
    const payload = denormalizeAnswerData(brut, [jury], "userA");
    expect(payload.aapStep2).toEqual({ commentaire: "ok" });
  });

  it("strippe les clés brutes legacy même sans champ parsé (input sans config)", () => {
    // `multiDecide` SANS `inputConfig` → le parse ne produit aucun champ de
    // décision ; la valeur serveur, elle, est bien là et passerait sinon.
    const data = makeCoFormData({
      inputs: {
        aapStep2: {
          id: "aapStep2",
          name: "Jury",
          formParent: "form123",
          inputs: {
            commentaire: { type: "text", label: "Commentaire", placeholder: "" },
            decide: { type: "tpls.forms.ocecoform.multiDecide", label: "Sélection" },
          },
        },
      },
    });
    const fields = parseCoFormFields(data);
    expect(fields[0].fields.map((f) => f.name)).toEqual(["commentaire"]);

    const stepsData = normalizeAnswerData(REPONSES_SERVEUR, fields, "userA") as Record<string, unknown>;
    const payload = denormalizeAnswerData(stepsData, fields, "userA");
    expect(payload.aapStep2).toEqual({ commentaire: "ok" });
  });

  /**
   * Étapes ABSENTES DU PARSE — ne partent PAS, du tout.
   *
   * Leur bloc est pourtant dans ce que soumet le wizard : `normalizeAnswerData`
   * clone `answers` EN ENTIER, `CoFormProvider` installe ce clone dans
   * `stepsData`, et `submitAllData` dénormalise `stepsData` entier. Fait
   * backend (mainteneur du legacy, 9 sept. 2026) : une étape absente du payload
   * est PRÉSERVÉE à la sauvegarde (PHP et port Node), une étape présente est
   * écrasée clé par clé. Ré-émettre une étape non rendue, c'est donc écraser
   * avec l'instantané périmé de l'ouverture — notes du jury, `_multiEval`,
   * champs ordinaires compris — alors que ne rien émettre la conserve intacte.
   */
  it("une étape retirée du parse par l'appelant (`omitHiddenSteps`, wizard) est absente du payload", () => {
    // Cas nominal AAC (`AacCommunDetailPage`) : l'étape de jury est masquée au
    // déposant non-admin. Avec ≥ 2 étapes visibles on est en wizard, donc sur
    // le chemin `submitAllData` qui soumet TOUTES les étapes de `stepsData`.
    const parcours = makeParcoursJury();
    parcours.inputs!.aapStep3 = {
      id: "aapStep3",
      name: "Suivi",
      formParent: "form123",
      inputs: { suivi: { type: "text", label: "Suivi", placeholder: "" } },
    };
    const fields = parseCoFormFields(omitHiddenSteps(parcours, ["aapStep2"]));
    expect(fields.map((s) => s.subFormId)).toEqual(["aapStep1", "aapStep3"]);

    const stepsData = normalizeAnswerData(
      { ...REPONSES_SERVEUR, aapStep3: { suivi: "en cours" } },
      fields,
      "userA",
    ) as Record<string, unknown>;
    // Sanity : le bloc de l'étape masquée EST dans ce que le wizard soumet —
    // décision du jury ET champ ordinaire.
    expect(stepsData.aapStep2).toMatchObject({ selection: { userB: { c1: 4 } }, commentaire: "ok" });

    const payload = denormalizeAnswerData(stepsData, fields, "userA");
    // Pas seulement ses clés de décision : l'étape entière, `commentaire`
    // compris, sinon le backend l'écraserait clé par clé.
    expect(payload).not.toHaveProperty("aapStep2");
    expect(Object.keys(payload).sort()).toEqual(["aapStep1", "aapStep3"]);
    // Les étapes visibles ne sont pas affectées.
    expect(payload.aapStep1).toEqual({ titre: "Mon commun" });
    expect(payload.aapStep3).toEqual({ suivi: "en cours" });
  });

  it("une étape marquée `hideStep` par le formulaire est absente du payload", () => {
    const parcours = makeParcoursJury();
    parcours.inputs!.aapStep2.hideStep = true;
    const fields = parseCoFormFields(parcours);
    expect(fields.map((s) => s.subFormId)).toEqual(["aapStep1"]);

    const stepsData = normalizeAnswerData(REPONSES_SERVEUR, fields, "userA") as Record<string, unknown>;
    expect(stepsData).toHaveProperty("aapStep2");

    const payload = denormalizeAnswerData(stepsData, fields, "userA");
    expect(payload).toEqual({ aapStep1: { titre: "Mon commun" } });
  });

  it("conserve le rangement root-level `evaluation{key}` d'un champ parsé", () => {
    // `evaluation{key}` est une map `{ [categoryPath]: { [criteriaId]: vote } }`
    // dont les clés sont les NOMS DE CATÉGORIES saisis par l'admin — une
    // catégorie « selection » ou « evaluation » y est légitime. La clé est
    // produite par la boucle à partir d'un champ parsé : elle part telle quelle.
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [
          makeField({ name: "evaluationCrit", componentType: "evaluation", type: "tpls.forms.cplx.evaluation" }),
          makeField({ name: "commentaire", componentType: "text" }),
        ],
        "aapStep1",
      ),
      makeSubFormFields([makeField({ name: "suivi", componentType: "text" })], "aapStep3"),
    ];
    const notes = { selection: { c1: "OK" }, evaluation: { c1: 3 }, pertinence: { c1: "" } };
    const stepsData = normalizeAnswerData(
      {
        evaluationCrit: notes,
        aapStep1: { commentaire: "ok" },
        aapStep3: { suivi: "en cours" },
        // Étape masquée, non parsée : absente du payload, elle.
        aapStep2: { selection: { userB: { c1: 4 } }, note: "x" },
      },
      fields,
      "userA",
    ) as Record<string, unknown>;
    const payload = denormalizeAnswerData(stepsData, fields, "userA");
    expect(payload.evaluationCrit).toEqual(notes);
    expect(payload.aapStep1).toEqual({ commentaire: "ok" });
    expect(payload.aapStep3).toEqual({ suivi: "en cours" });
    expect(payload).not.toHaveProperty("aapStep2");
  });

  it("retire le rangement root-level d'un champ NON parsé (porté par une étape masquée)", () => {
    // L'étape de jury porte un `evaluation` (rangé `evaluation{key}`) et un
    // commonTable (rangé `yesOrNo{key}` + `criterias{key}`) : trois clés
    // RACINE, hors du bloc de l'étape. Le parse complet en atteste.
    const parcours = makeParcoursJury();
    parcours.inputs!.aapStep2.inputs.grille = { type: "tpls.forms.cplx.evaluation", label: "Grille" };
    parcours.inputs!.aapStep2.inputs.besoins = { type: "tpls.forms.evaluation.commonTableV2", label: "Besoins" };
    const juryComplet = parseCoFormFields(parcours).find((s) => s.subFormId === "aapStep2")!;
    expect(juryComplet.fields.map((f) => [f.name, f.componentType])).toEqual(
      expect.arrayContaining([
        ["evaluationgrille", "evaluation"],
        ["yesOrNobesoins", "commonTable"],
      ]),
    );

    // Le déposant ne voit pas l'étape de jury : ces trois clés ne sont
    // produites par aucun champ parsé.
    const fields = parseCoFormFields(omitHiddenSteps(parcours, ["aapStep2"]));
    expect(fields.map((s) => s.subFormId)).toEqual(["aapStep1"]);

    const stepsData = normalizeAnswerData(
      {
        ...REPONSES_SERVEUR,
        evaluationgrille: { impact: { c1: 3 } },
        yesOrNobesoins: { crit1: { note: 2 } },
        criteriasbesoins: { crit1: { usage: "Bureautique", usageKey: "crit1", coeff: 1, label: "" } },
      },
      fields,
      "userA",
    ) as Record<string, unknown>;
    // Sanity : `normalizeAnswerData` les a bien recopiées telles quelles.
    expect(stepsData).toHaveProperty("evaluationgrille");
    expect(stepsData).toHaveProperty("yesOrNobesoins");
    expect(stepsData).toHaveProperty("criteriasbesoins");

    const payload = denormalizeAnswerData(stepsData, fields, "userA");
    expect(payload).toEqual({ aapStep1: { titre: "Mon commun" } });
  });

  it("conserve une étape parsée nommée `evaluationStep` (ancien angle mort de l'heuristique par préfixe)", () => {
    // Le tri se fait sur ce que le parse CONNAÎT, pas sur la forme du nom : une
    // étape dont l'id commence par `evaluation` est une étape si elle est
    // parsée (conservée avec ses données), et rien du tout sinon (retirée).
    const parcours = makeParcoursJury();
    parcours.inputs!.evaluationStep = {
      id: "evaluationStep",
      name: "Auto-évaluation",
      formParent: "form123",
      inputs: { bilan: { type: "text", label: "Bilan", placeholder: "" } },
    };
    parcours.inputs!.evaluationJury = {
      id: "evaluationJury",
      name: "Jury bis",
      formParent: "form123",
      inputs: { verdict: { type: "text", label: "Verdict", placeholder: "" } },
    };
    const fields = parseCoFormFields(omitHiddenSteps(parcours, ["aapStep2", "evaluationJury"]));
    expect(fields.map((s) => s.subFormId)).toEqual(["aapStep1", "evaluationStep"]);

    const stepsData = normalizeAnswerData(
      {
        ...REPONSES_SERVEUR,
        evaluationStep: { bilan: "positif" },
        evaluationJury: { verdict: "retenu", selection: { userB: { c1: 4 } } },
      },
      fields,
      "userA",
    ) as Record<string, unknown>;
    const payload = denormalizeAnswerData(stepsData, fields, "userA");
    expect(payload).toEqual({
      aapStep1: { titre: "Mon commun" },
      evaluationStep: { bilan: "positif" },
    });
  });

  it("laisse intacts le pack `_multiEval` et les `dynamicFields` d'une étape parsée", () => {
    // Le périmètre ne retire que des clés RACINE : à l'intérieur d'une étape
    // parsée, les traitements existants (pack multi-eval de l'user courant,
    // filtrage des lignes vides) produisent exactement ce qu'ils produisaient.
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [
          makeField({ name: "avis", componentType: "radio", options: ["oui", "non"], activeMultieval: true }),
          makeField({
            name: "partenaires",
            componentType: "dynamicFields",
            dynamicFieldsConfig: {
              enableMultipleRows: true,
              minRows: 1,
              maxRows: 3,
              fieldsConfig: [{ key: "nom", label: "Nom", type: "text" }],
            },
          }),
        ],
        "aapStep1",
      ),
    ];
    const stepsData = normalizeAnswerData(
      {
        aapStep1: {
          avis_multiEval: { userB: { value: "non", date: "d", answer: "1_non" } },
          partenaires: [{ nom: "ADAPTETONSPORT" }],
        },
        // Étape masquée : son `_multiEval` ne repart pas non plus, le backend
        // le préserve tel quel.
        aapStep2: { avis_multiEval: { userB: { value: "non", date: "d", answer: "1_non" } } },
      },
      fields,
      "userA",
    ) as Record<string, unknown>;
    (stepsData.aapStep1 as Record<string, unknown>).avis = "oui";
    (stepsData.aapStep1 as Record<string, unknown>).partenaires = [{ nom: "ADAPTETONSPORT" }, { nom: "" }];

    const payload = denormalizeAnswerData(stepsData, fields, "userA");
    expect(payload).toEqual({
      aapStep1: {
        avis_multiEval: { userA: { value: "oui", date: "now", answer: "0_oui" } },
        partenaires: [{ nom: "ADAPTETONSPORT" }],
      },
    });
  });

  it("préserve un champ ORDINAIRE déclaré sous une clé homonyme", () => {
    // Un `text` nommé `selection` est un vrai champ du formulaire : il n'a
    // rien à voir avec l'input de jury et doit être soumis comme les autres.
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [makeField({ name: "selection", componentType: "text" })],
        "step1",
      ),
    ];
    const payload = denormalizeAnswerData({ step1: { selection: "libre" } }, fields);
    expect(payload.step1).toEqual({ selection: "libre" });
  });

  it("ne touche pas au pack `_multiEval` d'un radio de la même étape", () => {
    const fields: SubFormFields[] = [
      makeSubFormFields(
        [
          makeField({
            name: "avis",
            componentType: "radio",
            options: ["oui", "non"],
            activeMultieval: true,
          }),
          makeField({ name: "selection", componentType: "selection", type: "tpls.forms.aap.selection" }),
        ],
        "aapStep2",
      ),
    ];
    const payload = denormalizeAnswerData(
      { aapStep2: { avis: "oui", selection: { userB: { c1: 4 } } } },
      fields,
      "userA",
    );
    const jury = payload.aapStep2 as Record<string, unknown>;
    expect(jury).not.toHaveProperty("selection");
    expect(jury).not.toHaveProperty("avis");
    expect(jury.avis_multiEval).toEqual({ userA: { value: "oui", date: "now", answer: "0_oui" } });
  });

  it("ne mute pas l'objet d'entrée (les champs continuent de lire `stepsData`)", () => {
    const fields = parseCoFormFields(makeParcoursJury());
    const stepsData = normalizeAnswerData(REPONSES_SERVEUR, fields, "userA") as Record<string, unknown>;
    const avant = JSON.stringify(stepsData);
    denormalizeAnswerData(stepsData, fields, "userA");
    expect(JSON.stringify(stepsData)).toBe(avant);
  });
});

/**
 * L'éditeur markdown est ACTIF PAR DÉFAUT sur les textarea.
 *
 * Relevé sur le parc : 754 textarea, dont AUCUN ne porte `enableMarkdown: true`
 * et un seul le porte à `false`. Inverser le défaut fait donc basculer 753
 * champs — d'où des tests sur les trois cas, y compris la désactivation
 * explicite qui doit survivre.
 */
describe("textarea — markdown actif par défaut", () => {
  const parse = (enableMarkdown?: boolean | string) =>
    parseCoFormFields(
      makeCoFormData({
        inputs: {
          step1: {
            id: "step1",
            name: "Étape",
            formParent: "form123",
            inputs: {
              texte: { type: "tpls.forms.textarea", label: "Texte", enableMarkdown },
            },
          },
        },
      })
    )[0].fields[0];

  it("actif quand l'option est absente — le cas de 753 champs sur 754", () => {
    expect(parse(undefined).markdown).toBe(true);
  });

  it("actif quand l'option vaut true", () => {
    expect(parse(true).markdown).toBe(true);
  });

  it("DÉSACTIVÉ par un false explicite", () => {
    expect(parse(false).markdown).toBe(false);
  });

  it("désactivé aussi par la CHAÎNE \"false\"", () => {
    // Le parc stocke volontiers ses booléens en chaînes : une telle valeur doit
    // désactiver, pas activer par accident.
    expect(parse("false").markdown).toBe(false);
  });
});

// ============================================================================
// Visibilité des inputs : `hideInForm` et `access.restrictedFields`
// ============================================================================

describe("isTruthyFlag", () => {
  it("accepte les formes vraies du parc, booléen comme chaîne", () => {
    // Le PHP lit ces drapeaux avec `filter_var(FILTER_VALIDATE_BOOLEAN)`.
    for (const v of [true, 1, "true", "TRUE", " true ", "1", "on", "yes"]) {
      expect(isTruthyFlag(v)).toBe(true);
    }
  });

  it("refuse la CHAÎNE \"false\" — là où le legacy la prend pour vraie", () => {
    // `\"false\" == true` vaut true en PHP : le legacy masquerait le champ.
    expect(isTruthyFlag("false")).toBe(false);
  });

  it("refuse les valeurs vides, absentes ou inattendues", () => {
    for (const v of [false, 0, "", "0", "off", null, undefined, {}, []]) {
      expect(isTruthyFlag(v)).toBe(false);
    }
  });
});

/**
 * Topologie relevée en base sur l'étape `677e7e389058e31575550aca` du form
 * « Les communs des CAEs » : deux inputs, `decide` masqué par `hideInForm` et
 * `choose` réservé aux admins. Le motif est celui de 12 formulaires AAP.
 */
function makeEtapeJury(overrides: Partial<CoFormData> = {}): CoFormData {
  return makeCoFormData({
    inputs: {
      aapStep2: {
        name: "Décision",
        id: "aapStep2",
        formParent: "form123",
        inputs: {
          decide: { label: "Décision", type: "tpls.forms.ocecoform.multiDecide", hideInForm: true },
          choose: { label: "Publier dans l'annuaire", type: "tpls.forms.aap.chooseProposal" },
          // Champ ordinaire masqué : `decide` seul ne prouverait rien, un
          // multiDecide sans `inputConfig` étant de toute façon écarté par
          // `resolveMultiDecide`.
          note: { label: "Note d'instruction", type: "text", hideInForm: true },
          libre: { label: "Commentaire", type: "textarea" },
        },
      },
    },
    ...overrides,
  });
}

describe("parseCoFormFields — hideInForm", () => {
  it("écarte l'input marqué, garde les autres", () => {
    const fields = parseCoFormFields(makeEtapeJury())[0].fields;
    expect(fields.map((f) => f.name)).toEqual(["choose", "libre"]);
  });

  it("s'applique AVANT la résolution multiDecide", () => {
    // `decide` est un placeholder qui se réindexe sous le type visé. Si le
    // masquage passait après, l'input reparaîtrait sous son nouveau nom.
    const data = makeEtapeJury({ inputConfig: { multiDecide: "tpls.forms.aap.selection" } });
    const fields = parseCoFormFields(data)[0].fields;
    expect(fields.map((f) => f.name)).toEqual(["choose", "libre"]);
  });

  it("un champ masqué ne peut plus rendre le formulaire insoumettable", () => {
    // 2 inputs du parc cumulent hideInForm + isRequired. Laissés au schéma, ils
    // exigeraient une saisie sur un champ que personne ne voit.
    const data = makeCoFormData({
      inputs: {
        step1: {
          name: "Step 1",
          id: "step1",
          formParent: "form123",
          inputs: {
            cache: { label: "Caché", type: "text", isRequired: true, hideInForm: true },
            visible: { label: "Visible", type: "text" },
          },
        },
      },
    });
    const parsed = parseCoFormFields(data);
    expect(generateZodSchema(parsed).safeParse({ step1: { visible: "ok" } }).success).toBe(true);
    const defauts = generateDefaultValues(parsed);
    expect(defauts).toHaveProperty("visible");
    expect(defauts).not.toHaveProperty("cache");
  });

  it("ne masque pas sur une valeur fausse ou absente", () => {
    const data = makeCoFormData({
      inputs: {
        step1: {
          name: "Step 1",
          id: "step1",
          formParent: "form123",
          inputs: {
            a: { label: "A", type: "text", hideInForm: false },
            b: { label: "B", type: "text", hideInForm: "false" },
            c: { label: "C", type: "text" },
          },
        },
      },
    });
    expect(parseCoFormFields(data)[0].fields.map((f) => f.name)).toEqual(["a", "b", "c"]);
  });
});

describe("parseCoFormFields — access.restrictedFields", () => {
  it("écarte les champs que le serveur a déclarés interdits", () => {
    // `choose` porte `isAdminOnly` en base ; c'est le backend qui tranche et le
    // renvoie ici (`Coform::computeAdminOnlyFields`).
    const data = makeEtapeJury({ access: makeAccess(["choose"]) });
    expect(parseCoFormFields(data)[0].fields.map((f) => f.name)).toEqual(["libre"]);
  });

  it("laisse tout passer quand la liste est vide ou absente", () => {
    expect(
      parseCoFormFields(makeEtapeJury({ access: makeAccess([]) }))[0]
        .fields.map((f) => f.name)
    ).toEqual(["choose", "libre"]);
    expect(parseCoFormFields(makeEtapeJury())[0].fields.map((f) => f.name)).toEqual([
      "choose",
      "libre",
    ]);
  });

  it("sort aussi du schéma et des valeurs par défaut, pas seulement du rendu", () => {
    // Sans ça, un champ restreint ET requis bloquerait la soumission sur une
    // erreur portant un champ que l'utilisateur ne voit nulle part.
    const data = makeCoFormData({
      access: makeAccess(["secret"]),
      inputs: {
        step1: {
          name: "Step 1",
          id: "step1",
          formParent: "form123",
          inputs: {
            secret: { label: "Secret", type: "text", isRequired: true },
            visible: { label: "Visible", type: "text" },
          },
        },
      },
    });
    const parsed = parseCoFormFields(data);
    expect(generateZodSchema(parsed).safeParse({ step1: { visible: "ok" } }).success).toBe(true);
    const defauts = generateDefaultValues(parsed);
    expect(defauts).toHaveProperty("visible");
    expect(defauts).not.toHaveProperty("secret");
  });
});

/**
 * Topologie relevée sur `677e7e389058e31575550ac7` (le doc `aapConfig` du form
 * « Les communs des CAEs ») : aapStep3 « Financement » et aapStep4 « Suivi »
 * sont cochées « Cacher etape ». 5 forms du parc masquent ainsi 7 étapes.
 */
function makeParcoursAap(hidden: Record<string, boolean> = {}): CoFormData {
  const etape = (id: string, nom: string) => ({
    name: nom,
    id,
    formParent: "form123",
    hideStep: hidden[id] ?? false,
    inputs: { [`${id}_champ`]: { label: nom, type: "text" } },
  });
  return makeCoFormData({
    inputs: {
      aapStep1: etape("aapStep1", "Dépôt"),
      aapStep2: etape("aapStep2", "Évaluation"),
      aapStep3: etape("aapStep3", "Financement"),
      aapStep4: etape("aapStep4", "Suivi"),
    },
  });
}

describe("parseCoFormFields — étapes masquées (hideStep)", () => {
  it("retire l'étape entière, sommaire du wizard compris", () => {
    // Le stepper de `MultiStepCoForm` dérive du même parse : retirer ici suffit
    // à faire disparaître l'étape du sommaire ET de son contenu.
    const parsed = parseCoFormFields(makeParcoursAap({ aapStep3: true, aapStep4: true }));
    expect(parsed.map((s) => s.subFormId)).toEqual(["aapStep1", "aapStep2"]);
  });

  it("emporte les champs de l'étape hors du schéma et des défauts", () => {
    const parsed = parseCoFormFields(makeParcoursAap({ aapStep3: true }));
    const defauts = generateDefaultValues(parsed);
    expect(defauts).not.toHaveProperty("aapStep3_champ");
    expect(generateZodSchema(parsed).safeParse({}).success).toBe(true);
  });

  it("ne masque rien quand aucune étape n'est cochée", () => {
    expect(parseCoFormFields(makeParcoursAap()).map((s) => s.subFormId)).toEqual([
      "aapStep1",
      "aapStep2",
      "aapStep3",
      "aapStep4",
    ]);
  });

  it("masque pour TOUT LE MONDE — aucune exemption admin", () => {
    // Écart assumé avec le legacy, qui laisse l'étape visible à l'admin de la
    // réponse. Le parse ne reçoit aucune identité d'utilisateur : l'assertion
    // porte sur le comportement, pas sur l'arité de la fonction — un paramètre
    // à valeur par défaut (la forme qu'aurait une exemption) laisserait
    // `Function.length` inchangé.
    const parsed = parseCoFormFields(makeParcoursAap({ aapStep1: true }));
    expect(parsed.map((s) => s.subFormId)).not.toContain("aapStep1");
  });

  it("n'est PAS déclenché par hideStepStandalone", () => {
    // Le `standAlone` du legacy désigne la page de réponse dédiée, sans
    // équivalent ici ; le « standalone » de site-json est une étape réclamée
    // explicitement par la config du site — la masquer viderait la page.
    const data = makeParcoursAap();
    (data.inputs as Record<string, { hideStepStandalone?: boolean }>).aapStep3.hideStepStandalone =
      true;
    expect(parseCoFormFields(data).map((s) => s.subFormId)).toContain("aapStep3");
  });
});

describe("parseCoFormFields — contrat de clé des champs restreints", () => {
  /**
   * Les deux producteurs PHP (`extractKuniksFromPaths`, `computeAdminOnlyFields`)
   * émettent des **kuniks bruts**. Or un finder d'input `k1` s'appelle
   * `finderk1` une fois parsé : c'est exactement là que la garde de parse (clé
   * brute) et l'ancienne garde de rendu (`getOriginalFieldKey`) divergeaient.
   */
  const avecPrefixe = (restricted: string[]) =>
    parseCoFormFields(
      makeCoFormData({
        access: makeAccess(restricted),
        inputs: {
          step1: {
            name: "Step 1",
            id: "step1",
            formParent: "form123",
            inputs: {
              k1: { label: "Lieu", type: "tpls.forms.cplx.finder" },
              k2: { label: "Libre", type: "text" },
            },
          },
        },
      })
    )[0].fields.map((f) => f.name);

  it("le kunik BRUT suffit à écarter un champ dont le nom parsé est préfixé", () => {
    expect(avecPrefixe([])).toEqual(["finderk1", "k2"]);
    expect(avecPrefixe(["k1"])).toEqual(["k2"]);
  });

  it("le nom PARSÉ ne déclenche rien — ce n'est pas le contrat du backend", () => {
    expect(avecPrefixe(["finderk1"])).toEqual(["finderk1", "k2"]);
  });
});

describe("getSharedFinderInfo — lecture structurelle", () => {
  const dansEtape = (hideStep: boolean) =>
    getSharedFinderInfo(
      makeCoFormData({
        sharedQuestionPath: ["step1.finderk1"],
        // `finderConfig` n'est monté que si `params.finder<kunik>` existe — et
        // `getSharedFinderInfo` retourne `null` sans lui.
        params: { finderk1: { type: "organizations", multiple: false } },
        inputs: {
          step1: {
            name: "Step 1",
            id: "step1",
            formParent: "form123",
            hideStep,
            inputs: { k1: { label: "Lieu", type: "tpls.forms.cplx.finder" } },
          },
        },
      })
    );

  it("trouve le finder partagé MÊME dans une étape masquée", () => {
    // Le finder partagé désigne le lieu auquel la réponse se rattache : il
    // pilote pré-remplissage, verrouillage et filtres du mode collaboratif.
    // Le perdre parce qu'un admin a coché « cacher l'étape » dégraderait le
    // mode par lieu en silence.
    expect(dansEtape(false)?.fieldName).toBe("finderk1");
    expect(dansEtape(true)?.fieldName).toBe("finderk1");
  });
});

// ============================================================================
// Ordre d'affichage des champs
// ============================================================================

const FORM_PARENT = "6438366673d20a0de1533c77";

/**
 * Étape d'analyse collective d'« Appel à commun des tiers lieux », réduite mais
 * FIDÈLE aux données réelles :
 *
 *  - l'ordre d'insertion Mongo place les titres de section AVANT les questions ;
 *  - aucun de ces inputs ne porte `position` — seulement `positions[formParent]`.
 *
 * C'est la conjonction des deux qui produisait le bug : 15 inputs sur 17
 * retombaient à 0, et le tri stable rendait alors l'ordre d'insertion — les 6
 * titres groupés en tête, puis les 9 questions.
 */
function makeAnalyseCollective(): CoFormData {
  const titre = (n: string) => ({ label: n, type: "tpls.forms.sectionTitle" });
  const question = (n: string) => ({ label: n, type: "tpls.forms.cplx.radioNew" });
  return makeCoFormData({
    inputs: {
      aapStep2: {
        name: "Analyse collective",
        id: "aapStep2",
        formParent: FORM_PARENT,
        inputs: {
          titreJuridique: { ...titre("Juridique"), positions: { [FORM_PARENT]: "2" } },
          titreEco: { ...titre("Economique"), positions: { [FORM_PARENT]: "7" } },
          titreUsage: { ...titre("Usage"), positions: { [FORM_PARENT]: "23" } },
          qStructuration: { ...question("Structuration juridique"), positions: { [FORM_PARENT]: "3" } },
          qLicences: { ...question("Licences"), positions: { [FORM_PARENT]: "5" } },
          qModele: { ...question("Modèle économique"), positions: { [FORM_PARENT]: "8" } },
          qUsage: { ...question("Utilisé par"), positions: { [FORM_PARENT]: "24" } },
        },
      },
    },
  });
}

describe("resolveInputOrder", () => {
  it("préfère la position du formulaire parent à la clé plate", () => {
    expect(resolveInputOrder({ position: "9", positions: { [FORM_PARENT]: "2" } }, FORM_PARENT)).toBe(2);
  });

  it("retombe sur `position` quand ce parent n'a pas d'entrée", () => {
    // 766 inputs du parc portent des positions pour PLUSIEURS parents : lire la
    // map sans la scoper mélangerait l'ordre de deux formulaires distincts.
    expect(resolveInputOrder({ position: "9", positions: { autreForm: "2" } }, FORM_PARENT)).toBe(9);
  });

  it("rend 0 quand aucune position n'est connue", () => {
    expect(resolveInputOrder({}, FORM_PARENT)).toBe(0);
    expect(resolveInputOrder({ position: "abc" }, FORM_PARENT)).toBe(0);
  });

  it("rend 0 sans formulaire parent, même si des positions existent", () => {
    expect(resolveInputOrder({ positions: { [FORM_PARENT]: "5" } }, undefined)).toBe(0);
  });
});

describe("parseCoFormFields — ordre des champs", () => {
  it("intercale les titres de section au lieu de les grouper en tête", () => {
    const fields = parseCoFormFields(makeAnalyseCollective())[0].fields;
    expect(fields.map((f) => f.name)).toEqual([
      "titreJuridique", // 2
      "qStructuration", // 3
      "qLicences", // 5
      "titreEco", // 7
      "qModele", // 8
      "titreUsage", // 23
      "qUsage", // 24
    ]);
  });

  it("ignore les positions déclarées pour un AUTRE formulaire parent", () => {
    const data = makeCoFormData({
      inputs: {
        aapStep1: {
          name: "Dépôt",
          id: "aapStep1",
          formParent: FORM_PARENT,
          inputs: {
            // Ordre voulu par CET AAP : titre puis description. L'autre parent
            // les veut dans l'ordre inverse — il ne doit pas s'imposer ici.
            description: { label: "Description", type: "textarea", positions: { [FORM_PARENT]: "2", autreForm: "1" } },
            titre: { label: "Titre", type: "text", positions: { [FORM_PARENT]: "1", autreForm: "2" } },
          },
        },
      },
    });
    expect(parseCoFormFields(data)[0].fields.map((f) => f.name)).toEqual(["titre", "description"]);
  });

  it("continue de trier sur `position` quand `positions` est absent", () => {
    const data = makeCoFormData({
      inputs: {
        step1: {
          name: "Step 1",
          id: "step1",
          formParent: "form123",
          inputs: {
            second: { label: "Second", type: "text", position: "2" },
            premier: { label: "Premier", type: "text", position: "1" },
          },
        },
      },
    });
    expect(parseCoFormFields(data)[0].fields.map((f) => f.name)).toEqual(["premier", "second"]);
  });

  it("conserve l'ordre de déclaration à position égale", () => {
    // Les deux premiers inputs de l'étape 2 réelle partagent `positions = "1"`.
    const data = makeCoFormData({
      inputs: {
        aapStep2: {
          name: "Décision",
          id: "aapStep2",
          formParent: FORM_PARENT,
          inputs: {
            premier: { label: "Dépenses", type: "text", positions: { [FORM_PARENT]: "1" } },
            second: { label: "Sélection", type: "text", positions: { [FORM_PARENT]: "1" } },
          },
        },
      },
    });
    expect(parseCoFormFields(data)[0].fields.map((f) => f.name)).toEqual(["premier", "second"]);
  });

  it("garde sa position à un multiDecide réindexé", () => {
    // `decide` se rend sous la clé `selection` : relire sa position par la clé
    // du champ APRÈS coup échouait, et le renvoyait en tête avec un 0.
    const data = makeCoFormData({
      inputConfig: { multiDecide: "tpls.forms.aap.selection" },
      inputs: {
        aapStep2: {
          name: "Décision",
          id: "aapStep2",
          formParent: FORM_PARENT,
          inputs: {
            decide: { label: "Décision", type: "tpls.forms.ocecoform.multiDecide", positions: { [FORM_PARENT]: "5" } },
            libre: { label: "Commentaire", type: "textarea", positions: { [FORM_PARENT]: "1" } },
          },
        },
      },
    });
    expect(parseCoFormFields(data)[0].fields.map((f) => f.name)).toEqual(["libre", "selection"]);
  });
});

describe("omitHiddenSteps (masquage décidé par l'appelant)", () => {
  const deuxEtapes = () =>
    makeCoFormData({
      inputs: {
        aapStep1: {
          name: "Dépôt",
          id: "aapStep1",
          formParent: FORM_PARENT,
          inputs: { titre: { label: "Titre", type: "text" } },
        },
        aapStep2: {
          name: "Analyse collective",
          id: "aapStep2",
          formParent: FORM_PARENT,
          inputs: {
            critere: { label: "Critère", type: "text", isRequired: true },
            libre: { label: "Commentaire", type: "textarea" },
          },
        },
      },
    });

  it("retire l'étape demandée de la DONNÉE, pas seulement du parse", () => {
    // C'est tout l'enjeu : `CoFormProvider`, `DynamicCoForm` et `CoFormReadOnly`
    // reparsent le formData qu'on leur passe. Une option de parse se serait
    // perdue à la frontière du composant, et l'étape serait restée rendue.
    const filtre = omitHiddenSteps(deuxEtapes(), ["aapStep2"]);
    expect(Object.keys(filtre.inputs ?? {})).toEqual(["aapStep1"]);
    expect(parseCoFormFields(filtre).map((e) => e.subFormId)).toEqual(["aapStep1"]);
  });

  it("sort l'étape du schéma Zod, pas seulement du rendu", () => {
    // Sans ça, le `critere` requis de l'étape masquée rendrait le formulaire
    // insoumettable pour un déposant qui ne voit même pas l'étape.
    const etapes = parseCoFormFields(omitHiddenSteps(deuxEtapes(), ["aapStep2"]));
    expect(generateZodSchema(etapes).safeParse({ titre: "Un commun" }).success).toBe(true);
  });

  it("sort l'étape des valeurs par défaut", () => {
    const defauts = generateDefaultValues(
      parseCoFormFields(omitHiddenSteps(deuxEtapes(), ["aapStep2"]))
    );
    expect(defauts).toHaveProperty("titre");
    expect(defauts).not.toHaveProperty("critere");
    expect(defauts).not.toHaveProperty("libre");
  });

  it("rend l'objet D'ORIGINE quand il n'y a rien à retirer", () => {
    // Identité préservée : les mémoïsations en aval ne sont pas invalidées
    // pour rien à chaque rendu.
    const data = deuxEtapes();
    expect(omitHiddenSteps(data, undefined)).toBe(data);
    expect(omitHiddenSteps(data, [])).toBe(data);
    expect(omitHiddenSteps(data, ["etapeInexistante"])).toBe(data);
  });

  it("ne modifie jamais l'objet reçu", () => {
    const data = deuxEtapes();
    omitHiddenSteps(data, ["aapStep2"]);
    expect(Object.keys(data.inputs ?? {})).toEqual(["aapStep1", "aapStep2"]);
  });
});
