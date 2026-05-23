import { describe, it, expect, vi } from "vitest";
import {
  filtersByAnswersQueryKey,
  fetchFiltersByAnswers,
  type FiltersByAnswersOptions,
} from "./useFiltersByAnswers";

describe("filtersByAnswersQueryKey", () => {
  it("retourne un tuple [\"filters-by-answers\", query, serialized]", () => {
    const opts: FiltersByAnswersOptions = {
      domain: { id: "d1", label: { fr: "Domaine" } },
    };
    const key = filtersByAnswersQueryKey("my-query", opts);
    expect(key).toEqual([
      "filters-by-answers",
      "my-query",
      JSON.stringify(opts),
    ]);
  });

  it("génère la même clé pour les mêmes inputs", () => {
    const opts: FiltersByAnswersOptions = {
      d: { id: "1", label: { fr: "x" } },
    };
    expect(filtersByAnswersQueryKey("q", opts)).toEqual(
      filtersByAnswersQueryKey("q", opts)
    );
  });

  it("clés différentes pour des options différentes", () => {
    const k1 = filtersByAnswersQueryKey("q", { a: { id: "1", label: { fr: "x" } } });
    const k2 = filtersByAnswersQueryKey("q", { a: { id: "2", label: { fr: "x" } } });
    expect(k1).not.toEqual(k2);
  });
});

describe("fetchFiltersByAnswers", () => {
  it("appelle entity.coformFiltersSearch avec { searchedData: options }", async () => {
    const entity = {
      coformFiltersSearch: vi.fn().mockResolvedValue({}),
    };
    const opts: FiltersByAnswersOptions = {
      domain: { id: "d1", label: { fr: "Domaine" } },
    };
    await fetchFiltersByAnswers(entity, opts);
    expect(entity.coformFiltersSearch).toHaveBeenCalledWith({
      searchedData: opts,
    });
  });

  it("transforme la réponse SDK en map label/values", async () => {
    const entity = {
      coformFiltersSearch: vi.fn().mockResolvedValue({
        domain: {
          results: {
            org1: { image: "/i1.png", name: "Org 1", orgaNameArray: ["a"] },
            org2: { image: "/i2.png", name: "Org 2", orgaNameArray: ["b"] },
          },
        },
      }),
    };
    const result = await fetchFiltersByAnswers(entity, {
      domain: { id: "d1", label: { fr: "Domaine" } },
    });
    expect(result.domain).toBeDefined();
    expect(result.domain.label).toEqual({ fr: "Domaine" });
    expect(result.domain.values).toEqual({
      org1: { image: "/i1.png", name: "Org 1", orgaNameArray: ["a"] },
      org2: { image: "/i2.png", name: "Org 2", orgaNameArray: ["b"] },
    });
  });

  it("filtre la clé spéciale 'distinctElements' du résultat", async () => {
    const entity = {
      coformFiltersSearch: vi.fn().mockResolvedValue({
        domain: {
          results: {
            org1: { image: "/x", name: "O", orgaNameArray: [] },
            distinctElements: { foo: "bar" },
          },
        },
      }),
    };
    const result = await fetchFiltersByAnswers(entity, {
      domain: { id: "d1", label: { fr: "D" } },
    });
    expect(result.domain.values).toHaveProperty("org1");
    expect(result.domain.values).not.toHaveProperty("distinctElements");
  });

  it("ignore les entrées sans 'results'", async () => {
    const entity = {
      coformFiltersSearch: vi.fn().mockResolvedValue({
        domain: { error: "no results" },
        other: { results: { x: { image: "", name: "X", orgaNameArray: [] } } },
      }),
    };
    const result = await fetchFiltersByAnswers(entity, {
      domain: { id: "d", label: { fr: "D" } },
      other: { id: "o", label: { fr: "O" } },
    });
    expect(result).not.toHaveProperty("domain");
    expect(result).toHaveProperty("other");
  });

  it("retourne un objet vide si la réponse SDK n'est pas un objet", async () => {
    const entity = { coformFiltersSearch: vi.fn().mockResolvedValue(null) };
    const result = await fetchFiltersByAnswers(entity, {
      domain: { id: "d", label: { fr: "D" } },
    });
    expect(result).toEqual({});
  });

  it("retourne un objet vide si la réponse SDK est une string", async () => {
    const entity = { coformFiltersSearch: vi.fn().mockResolvedValue("oops") };
    const result = await fetchFiltersByAnswers(entity, {});
    expect(result).toEqual({});
  });

  it("utilise la clé comme label si options[key]?.label absent", async () => {
    const entity = {
      coformFiltersSearch: vi.fn().mockResolvedValue({
        unknownKey: {
          results: { x: { image: "", name: "X", orgaNameArray: [] } },
        },
      }),
    };
    const result = await fetchFiltersByAnswers(entity, {
      // unknownKey n'est PAS dans options → fallback sur la clé en string
    });
    expect(result.unknownKey.label).toEqual({ fr: "unknownKey" });
  });

  it("wrap les labels string en { fr: string }", async () => {
    const entity = {
      coformFiltersSearch: vi.fn().mockResolvedValue({
        a: { results: { v1: { image: "", name: "", orgaNameArray: [] } } },
      }),
    };
    // label fourni en string, devrait être wrappé
    const result = await fetchFiltersByAnswers(entity, {
      a: {
        id: "a",
        // @ts-expect-error label string pour tester le wrap
        label: "Just a string",
      },
    });
    expect(result.a.label).toEqual({ fr: "Just a string" });
  });

  it("ignore les entrées sans clé 'results' valide (results non-object)", async () => {
    const entity = {
      coformFiltersSearch: vi.fn().mockResolvedValue({
        domain: { results: "not an object" },
      }),
    };
    const result = await fetchFiltersByAnswers(entity, {
      domain: { id: "d", label: { fr: "D" } },
    });
    expect(result).not.toHaveProperty("domain");
  });
});
