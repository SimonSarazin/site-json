import { describe, it, expect } from "vitest";
import {
  buildSimpleTableHeaders,
  buildEmptySimpleTableRow,
  upsertSimpleTableRow,
  removeSimpleTableRow,
} from "./simpleTable";
import { generateZodSchema } from "./formParser";
import type { FormFieldMapping, SimpleTableConfig, SimpleTableValue, SubFormFields } from "../types";

const config: SimpleTableConfig = {
  tableName: "Salle",
  columns: [
    { label: "Surface", type: "Nombre" },
    { label: "Photos", type: "Images" },
  ],
  rows: [],
  activeNewLine: false,
  singleAnswerByLine: false,
  editInModal: true,
};

const headers = () => buildSimpleTableHeaders(config);

const field: FormFieldMapping = {
  name: "tbl",
  label: "Tableau",
  type: "tpls.forms.cplx.simpleTable",
  componentType: "simpleTable",
  isRequired: true,
  simpleTableConfig: config,
};
const subForms: SubFormFields[] = [{ subFormId: "step1", subFormName: "Step 1", fields: [field] }];

describe("simpleTable helpers", () => {
  it("buildSimpleTableHeaders → [tableName, ...labels de colonnes]", () => {
    expect(buildSimpleTableHeaders(config)).toEqual(["Salle", "Surface", "Photos"]);
  });

  it("buildEmptySimpleTableRow → ['', ...] avec [] pour les colonnes Images", () => {
    expect(buildEmptySimpleTableRow(config.columns)).toEqual(["", "", []]);
  });

  it("upsert 'new' sur une valeur VIDE sème d'abord la ligne d'en-têtes", () => {
    const out = upsertSimpleTableRow([], "new", buildEmptySimpleTableRow(config.columns), headers());
    expect(out).toEqual([
      ["Salle", "Surface", "Photos"],
      ["", "", []],
    ]);
  });

  it("upsert 'new' sur une valeur non vide append en fin, sans muter l'entrée", () => {
    const value: SimpleTableValue = [
      ["Salle", "Surface", "Photos"],
      ["A", "10", []],
    ];
    const out = upsertSimpleTableRow(value, "new", ["B", "20", []], headers());
    expect(out).toHaveLength(3);
    expect(out[2]).toEqual(["B", "20", []]);
    expect(value).toHaveLength(2); // pas de mutation
  });

  it("édition d'une ligne legacy plus large : le pattern du modal (draft = copie complète) préserve les cellules excédentaires", () => {
    const value: SimpleTableValue = [
      ["Salle", "Surface", "Photos"],
      ["A", "10", [], "extra-legacy"], // ligne plus large que la config
    ];
    // reproduit le modal : draft = copie profonde de la ligne, on édite une cellule
    const draft = value[1].map((c) => (Array.isArray(c) ? [...c] : c));
    draft[1] = "12";
    const out = upsertSimpleTableRow(value, 1, draft, headers());
    expect(out[1]).toEqual(["A", "12", [], "extra-legacy"]); // cellule excédentaire préservée
    expect(value[1]).toEqual(["A", "10", [], "extra-legacy"]); // original intact
  });

  it("removeSimpleTableRow retire la bonne ligne sans muter", () => {
    const value: SimpleTableValue = [["h"], ["a"], ["b"]];
    expect(removeSimpleTableRow(value, 1)).toEqual([["h"], ["b"]]);
    expect(value).toHaveLength(3);
  });

  it("parité de contrat : après upsert (ajout puis édition), la valeur passe TOUJOURS la validation Zod du champ", () => {
    const schema = generateZodSchema(subForms);
    // 1er ajout sur valeur vide → [headers, row] → length >= 2 (requis) OK
    const afterAdd = upsertSimpleTableRow([], "new", buildEmptySimpleTableRow(config.columns), headers());
    expect(schema.safeParse({ tbl: afterAdd }).success).toBe(true);
    // édition d'une ligne existante → shape 2D inchangé
    const afterEdit = upsertSimpleTableRow(afterAdd, 1, ["Salle A", "30", []], headers());
    expect(schema.safeParse({ tbl: afterEdit }).success).toBe(true);
  });
});
