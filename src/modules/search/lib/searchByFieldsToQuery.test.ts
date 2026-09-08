import { describe, it, expect } from "vitest";
import { searchByFieldsToQuery } from "./searchByFieldsToQuery";

import type { SearchByFieldValue } from "../contexts/pageFilters";

const entry = (v: Record<string, unknown>) => v as unknown as SearchByFieldValue;

describe("searchByFieldsToQuery", () => {
  it("champ simple → filters { field: { $in } } (fusion multi-entrées, dédupliquée)", () => {
    const out = searchByFieldsToQuery({
      a: entry({ field: "services", value: ["s1", "s2"] }),
      b: entry({ field: "services", value: ["s2", "s3"] }),
    });
    expect(out.filters).toEqual({ services: { $in: ["s1", "s2", "s3"] } });
    expect(out.searchTarget).toBeNull();
  });

  it("scopeList → locality ; sourceKey → sourceKeys", () => {
    const out = searchByFieldsToQuery({
      z1: entry({ field: "974level3", type: "scopeList", value: { id: "974", type: "level3" } }),
      e1: entry({ field: "sourceKey", type: "sourceKey", value: ["laRosee"] }),
    });
    expect(out.locality).toEqual({ "974level3": { id: "974", type: "level3" } });
    expect(out.sourceKeys).toEqual(["laRosee"]);
    expect(out.filters).toEqual({});
  });

  it("searchTarget (« type d'info ») : porté séparément, PAS dans filters", () => {
    const target = { defaultTypes: ["poi"], defaultFilters: { type: "affiche" } };
    const out = searchByFieldsToQuery({
      "typeinfo-paroles": entry({ field: "searchTarget", type: "searchTarget", value: target }),
      autre: entry({ field: "tags", value: ["sport"] }),
    });
    expect(out.searchTarget).toEqual(target);
    expect(out.filters).toEqual({ tags: { $in: ["sport"] } });
  });

  it("dateRange : début → $gt (seul opérateur date converti par le backend) ; fin → $lte si présente", () => {
    const out = searchByFieldsToQuery({
      dates: entry({ field: "startDate", type: "dateRange", value: { start: "2026-07-01" } }),
    });
    expect(out.filters).toEqual({ startDate: { $gt: "2026-07-01" } });

    const both = searchByFieldsToQuery({
      dates: entry({ field: "startDate", type: "dateRange", value: { start: "2026-07-01", end: "2026-08-31" } }),
    });
    expect(both.filters).toEqual({ startDate: { $gt: "2026-07-01", $lte: "2026-08-31" } });
  });

  it("entrée vide → sorties vides et searchTarget null", () => {
    expect(searchByFieldsToQuery({})).toEqual({
      filters: {},
      locality: {},
      sourceKeys: [],
      searchTarget: null,
    });
  });
});

/**
 * Facettes sur une liste d'`answers` (`/creneaux`). La forme émise est celle
 * MESURÉE conforme sur les deux serveurs (legacy 5080 et Node 5099, réponses
 * byte-identiques) : `$or: { $and: [ {$or:[…]}, … ] }` = ET de OU.
 * Cf. `mongoFilters.ts` pour les formes qui font un 500 côté legacy.
 */
describe("searchByFieldsToQuery — facettes answerPath", () => {
  const MAL = "answers.eki_0.multiCheckboxPluseki_0maladies";
  const ALD = "answers.eki_0.multiCheckboxPluseki_0ald";

  it("une valeur → un OU d'une clause, sous la clé unique $or", () => {
    const out = searchByFieldsToQuery({
      "Obésité": entry({ field: MAL, type: "answerPath", value: ["Obésité"] }),
    });
    expect(out.filters).toEqual({
      $or: { $and: [{ $or: [{ [`${MAL}.Obésité`]: { $exists: true } }] }] },
    });
  });

  it("deux valeurs du MÊME groupe → OU (une seule clause $and)", () => {
    const out = searchByFieldsToQuery({
      "Obésité": entry({ field: MAL, type: "answerPath", value: ["Obésité"] }),
      "Cancer": entry({ field: MAL, type: "answerPath", value: ["Cancer"] }),
    });
    expect(out.filters).toEqual({
      $or: {
        $and: [
          {
            $or: [
              { [`${MAL}.Obésité`]: { $exists: true } },
              { [`${MAL}.Cancer`]: { $exists: true } },
            ],
          },
        ],
      },
    });
  });

  it("deux GROUPES → ET de OU (deux clauses $and)", () => {
    const out = searchByFieldsToQuery({
      "Obésité": entry({ field: MAL, type: "answerPath", value: ["Obésité"] }),
      "Cancer": entry({ field: MAL, type: "answerPath", value: ["Cancer"] }),
      "Diabète": entry({ field: ALD, type: "answerPath", value: ["Diabète"] }),
    });
    const and = (out.filters.$or as unknown as { $and: unknown[] }).$and;
    expect(and).toHaveLength(2);
    expect(and[0]).toEqual({
      $or: [
        { [`${MAL}.Obésité`]: { $exists: true } },
        { [`${MAL}.Cancer`]: { $exists: true } },
      ],
    });
    expect(and[1]).toEqual({ $or: [{ [`${ALD}.Diabète`]: { $exists: true } }] });
  });

  it("valeurs dupliquées : dédupliquées dans le OU", () => {
    const out = searchByFieldsToQuery({
      a: entry({ field: MAL, type: "answerPath", value: ["Obésité"] }),
      b: entry({ field: MAL, type: "answerPath", value: ["Obésité"] }),
    });
    const and = (out.filters.$or as unknown as { $and: Array<{ $or: unknown[] }> }).$and;
    expect(and[0].$or).toHaveLength(1);
  });

  it("libellé INEXPRIMABLE (point) : aucune clause, donc AUCUN $or — jamais de $or vide", () => {
    const out = searchByFieldsToQuery({
      a: entry({ field: MAL, type: "answerPath", value: ["Facilitateur.rice"] }),
    });
    expect(out.filters).toEqual({});
  });

  it("le groupe survit si UNE seule de ses valeurs est inexprimable", () => {
    const out = searchByFieldsToQuery({
      a: entry({ field: MAL, type: "answerPath", value: ["Facilitateur.rice"] }),
      b: entry({ field: MAL, type: "answerPath", value: ["Obésité"] }),
    });
    expect(out.filters).toEqual({
      $or: { $and: [{ $or: [{ [`${MAL}.Obésité`]: { $exists: true } }] }] },
    });
  });

  it("cohabite avec un filtre par champ ordinaire (ET implicite : clés distinctes)", () => {
    const out = searchByFieldsToQuery({
      s: entry({ field: "services", value: ["s1"] }),
      o: entry({ field: MAL, type: "answerPath", value: ["Obésité"] }),
    });
    expect(out.filters.services).toEqual({ $in: ["s1"] });
    expect(out.filters.$or).toBeDefined();
  });

  it("un groupe historique (_id) n'est PAS affecté", () => {
    const out = searchByFieldsToQuery({
      garderie: entry({ field: "_id", value: ["orgA", "orgB"] }),
    });
    expect(out.filters).toEqual({ _id: { $in: ["orgA", "orgB"] } });
  });
});
