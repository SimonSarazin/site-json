import { describe, expect, it } from "vitest";

import { buildFormCoverage, coverageAnswerFields, coverageOrgFields, filterRowsByAnswers, filterRowsByName, finderOrganizationIds, type FormCoverage } from "./formCoverage";

const OBS = "6525865cdeaf281bbc7280e9";
const AUTRE = "677e7e389058e31575550ac8";
const FINDER = "findercommunsDeCaes1696958044_0lnklp69hi0yszjihhe8";

/** Réponse telle que la recherche la rend : finder rangé dans son étape. */
const reponse = (id: string, form: unknown, finder?: Record<string, unknown>) => ({
  id,
  serverData: { form, answers: finder ? { communsDeCaes1696958044_0: { [FINDER]: finder } } : {} },
});

describe("finderOrganizationIds", () => {
  it("lit le finder dans son étape et garde les organisations", () => {
    const data = reponse("a1", OBS, { o1: { id: "o1", name: "OPTEOS", type: "organizations" } }).serverData;
    expect(finderOrganizationIds(data, FINDER)).toEqual(["o1"]);
  });

  it("écarte une entrée d'un autre type (citoyen), garde une entrée sans type (clé = id)", () => {
    const data = reponse("a1", OBS, { c1: { id: "c1", type: "citoyens" }, o2: { name: "Sans type" } }).serverData;
    expect(finderOrganizationIds(data, FINDER)).toEqual(["o2"]);
  });

  it("lit aussi une ligne déjà aplatie (input au premier niveau)", () => {
    expect(finderOrganizationIds({ [FINDER]: { o3: { id: "o3", type: "organizations" } } }, FINDER)).toEqual(["o3"]);
  });

  it("finder absent ou vide : aucune organisation", () => {
    expect(finderOrganizationIds(reponse("a1", OBS).serverData, FINDER)).toEqual([]);
    expect(finderOrganizationIds({ answers: { etape: { [FINDER]: "" } } }, FINDER)).toEqual([]);
  });
});

describe("buildFormCoverage", () => {
  const forms = [{ formId: OBS, finderInput: FINDER }];

  it("indexe organisation → réponses, par formulaire suivi", () => {
    const cov = buildFormCoverage(
      [
        reponse("a1", OBS, { o1: { id: "o1", type: "organizations" } }),
        reponse("a2", OBS, { o1: { id: "o1", type: "organizations" } }),
        reponse("a3", OBS, { o2: { id: "o2", type: "organizations" } }),
      ],
      forms,
    );
    expect(cov.get(OBS)?.get("o1")).toEqual(["a1", "a2"]);
    expect(cov.get(OBS)?.get("o2")).toEqual(["a3"]);
  });

  it("ignore une réponse d'un formulaire non suivi ; lit `form` en `{ $id }`", () => {
    const cov = buildFormCoverage(
      [
        reponse("a1", AUTRE, { o1: { id: "o1", type: "organizations" } }),
        reponse("a2", { $id: OBS }, { o2: { id: "o2", type: "organizations" } }),
      ],
      forms,
    );
    expect(cov.get(OBS)?.has("o1")).toBe(false);
    expect(cov.get(OBS)?.get("o2")).toEqual(["a2"]);
    expect(cov.has(AUTRE)).toBe(false);
  });

  it("`linkPaths` : lit aussi `links.organizations`, sans doublon avec le finder", () => {
    const viaLiens = { id: "a1", serverData: { form: OBS, links: { organizations: { o4: { type: "organizations" }, c1: { type: "citoyens" } } } } };
    const lesDeux = { id: "a2", serverData: { ...reponse("a2", OBS, { o5: { id: "o5" } }).serverData, links: { organizations: { o5: { type: "organizations" } } } } };
    const cov = buildFormCoverage([viaLiens, lesDeux], [{ formId: OBS, finderInput: FINDER, linkPaths: ["links.organizations"] }]);
    expect([...cov.get(OBS)!.keys()]).toEqual(["o4", "o5"]);
    expect(buildFormCoverage([viaLiens], forms).get(OBS)?.size).toBe(0);
  });

  it("formulaire suivi sans réponse : entrée vide, pas absente", () => {
    const cov = buildFormCoverage([], forms);
    expect(cov.get(OBS)?.size).toBe(0);
  });
});

describe("filterRowsByName", () => {
  const rows = [{ id: "o1", serverData: { name: "Coopérative OPTEOS" } }, { id: "o2", serverData: { name: "OZON" } }];

  it("sans casse ni accents", () => {
    expect(filterRowsByName(rows, "coopera").map((r) => r.id)).toEqual(["o1"]);
  });

  it("texte vide : toutes les lignes", () => {
    expect(filterRowsByName(rows, "  ")).toHaveLength(2);
  });
});

describe("filterRowsByAnswers", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
  // a : F1 + F2 · b : F1 seul · c : rien
  const coverage = new Map<string, FormCoverage>([
    ["F1", new Map([["a", ["r1"]], ["b", ["r2"]]])],
    ["F2", new Map([["a", ["r3"]]])],
  ]);
  const ids = (out: { id: string }[]) => out.map((r) => r.id);

  it("sans filtre : toutes les lignes", () => {
    expect(ids(filterRowsByAnswers(rows, coverage, {}))).toEqual(["a", "b", "c"]);
  });

  it("« Répondu » / « Pas de réponse » sur un formulaire", () => {
    expect(ids(filterRowsByAnswers(rows, coverage, { F1: "answered" }))).toEqual(["a", "b"]);
    expect(ids(filterRowsByAnswers(rows, coverage, { F1: "notAnswered" }))).toEqual(["c"]);
  });

  it("filtres cumulés en ET", () => {
    expect(ids(filterRowsByAnswers(rows, coverage, { F1: "answered", F2: "notAnswered" }))).toEqual(["b"]);
  });

  it("formulaire suivi sans aucune réponse : personne n'a répondu", () => {
    expect(ids(filterRowsByAnswers(rows, new Map([["F3", new Map()]]), { F3: "notAnswered" }))).toEqual(["a", "b", "c"]);
  });
});

describe("finder stocké en liste", () => {
  it("lit les valeurs d'un tableau comme ids, pas ses index", () => {
    const data = reponse("a1", OBS, [OBS, AUTRE] as unknown as Record<string, unknown>).serverData;
    expect(finderOrganizationIds(data, FINDER)).toEqual([OBS, AUTRE]);
  });

  it("tableau d'entrées : garde l'id et écarte un autre type", () => {
    const data = reponse("a1", OBS, [{ id: "o1" }, { id: "c1", type: "citoyens" }] as unknown as Record<string, unknown>).serverData;
    expect(finderOrganizationIds(data, FINDER)).toEqual(["o1"]);
  });
});

describe("projections", () => {
  it("organisations : name, slug et email toujours projetés, sans doublon", () => {
    expect(coverageOrgFields()).toEqual(["name", "slug", "email"]);
    expect(coverageOrgFields(["address", "name"])).toEqual(["address", "name", "slug", "email"]);
  });

  it("réponses : form, answers et chaque linkPaths", () => {
    expect(coverageAnswerFields([
      { formId: "f1", finderInput: "x" },
      { formId: "f2", finderInput: "y", linkPaths: ["links.organizations"] },
    ])).toEqual(["form", "answers", "links.organizations"]);
  });
});
