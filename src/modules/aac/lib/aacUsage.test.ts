import { describe, expect, it } from "vitest";
import {
  readUsageAnswer,
  readUsageLabels,
  usageLabelFromId,
  buildUsageTree,
  countTagFacets,
} from "./aacUsage";
import listingCapture from "../mocks/directoryResponse.listing.json";

const capture = listingCapture as unknown as { results: Record<string, unknown> };
const communs = Object.values(capture.results) as { answers?: Record<string, unknown> }[];

describe("readUsageAnswer", () => {
  it("repère la question par sa FORME, sans connaître son identifiant", () => {
    const usage = readUsageAnswer({
      titre: "un titre",
      tags: ["a"],
      questionInconnue: { list: ["1_alpha"], sublist: { "1_alpha": ["0_beta"] } },
    });

    expect(usage.categories).toEqual(["1_alpha"]);
    expect(usage.subs).toEqual(["0_beta"]);
    expect(usage.bySub).toEqual({ "1_alpha": ["0_beta"] });
  });

  it("accepte un override d'identifiant", () => {
    const usage = readUsageAnswer(
      {
        leurre: { list: ["9_leurre"] },
        vraie: { list: ["1_alpha"] },
      },
      "vraie"
    );
    expect(usage.categories).toEqual(["1_alpha"]);
  });

  it("tolère `list` seul, `sublist` seule, et l'absence des deux", () => {
    expect(readUsageAnswer({ q: { list: ["1_a"] } }).subs).toEqual([]);
    expect(readUsageAnswer({ q: { sublist: { "1_a": ["0_b"] } } }).categories).toEqual([]);
    expect(readUsageAnswer({ titre: "x" }).categories).toEqual([]);
    expect(readUsageAnswer(undefined).categories).toEqual([]);
  });

  it("écarte une sous-liste vide plutôt que de créer une catégorie fantôme", () => {
    const usage = readUsageAnswer({ q: { list: ["1_a"], sublist: { "1_a": [] } } });
    expect(usage.bySub).toEqual({});
  });
});

describe("usageLabelFromId", () => {
  it("retire l'index et rend le libellé lisible", () => {
    expect(usageLabelFromId("1_communication-externe")).toBe("Communication externe");
    expect(usageLabelFromId("15_autres-metiers")).toBe("Autres metiers");
  });

  it("laisse intact un identifiant sans index", () => {
    expect(usageLabelFromId("libre")).toBe("Libre");
  });
});

describe("readUsageLabels", () => {
  it("reconstruit la correspondance identifiant → libellé depuis form.params", () => {
    const labels = readUsageLabels({
      categorizedCheckboxq1: {
        list: ["Communication externe", "Coopération et communication interne"],
        sublist: { "0_communication-externe": ["Plateforme vidéo"] },
      },
      radioNewAutreChose: { list: ["ignoré"] },
    });

    expect(labels["0_communication-externe"]).toBe("Communication externe");
    // L'accent et la casse EXACTS, que la déduction depuis l'id ne rend pas.
    expect(labels["1_cooperation-et-communication-interne"]).toBe(
      "Coopération et communication interne"
    );
    expect(labels["0_plateforme-video"]).toBe("Plateforme vidéo");
    expect(labels["0_ignore"]).toBeUndefined();
  });
});

describe("buildUsageTree", () => {
  const usages = [
    readUsageAnswer({ q: { list: ["1_alpha"], sublist: { "1_alpha": ["0_x"] } } }),
    readUsageAnswer({ q: { list: ["1_alpha", "10_beta"] } }),
    readUsageAnswer({ q: { sublist: { "10_beta": ["0_y", "0_y"] } } }),
  ];

  it("compte les communs par catégorie et par sous-catégorie", () => {
    const tree = buildUsageTree(usages);

    expect(tree.map((c) => [c.id, c.count])).toEqual([
      ["1_alpha", 2],
      ["10_beta", 2],
    ]);
    expect(tree[1].children).toEqual([
      { id: "0_y", label: "Y", count: 1, children: [] },
    ]);
  });

  it("compte une catégorie citée UNIQUEMENT par sa sous-liste", () => {
    // Équivalent du `hasValidChildren` du PHP : la catégorie reste proposable.
    const tree = buildUsageTree([
      readUsageAnswer({ q: { sublist: { "3_gamma": ["0_z"] } } }),
    ]);
    expect(tree.map((c) => c.id)).toEqual(["3_gamma"]);
  });

  it("ordonne par l'index encodé, pas alphabétiquement", () => {
    const tree = buildUsageTree([
      readUsageAnswer({ q: { list: ["10_beta", "2_delta", "1_alpha"] } }),
    ]);
    expect(tree.map((c) => c.id)).toEqual(["1_alpha", "2_delta", "10_beta"]);
  });

  it("préfère les libellés du formulaire au repli déduit", () => {
    const tree = buildUsageTree(usages, { "1_alpha": "Libellé exact" });
    expect(tree[0].label).toBe("Libellé exact");
    expect(tree[1].label).toBe("Beta");
  });

  it("ne propose aucune option quand aucun commun n'en porte", () => {
    expect(buildUsageTree([])).toEqual([]);
  });
});

describe("countTagFacets", () => {
  it("compte chaque tag une fois par commun, et trie par décompte", () => {
    const options = countTagFacets([
      { tags: ["a", "b", "a"] },
      { tags: ["b"] },
      { tags: ["b", "c"] },
    ]);
    expect(options).toEqual([
      { id: "b", label: "b", count: 3 },
      { id: "a", label: "a", count: 1 },
      { id: "c", label: "c", count: 1 },
    ]);
  });
});

describe("sur la capture réelle", () => {
  const usages = communs.map((c) => readUsageAnswer(c.answers?.aapStep1));

  it("lit un usage sur chacun des communs", () => {
    expect(usages.every((u) => u.categories.length > 0 || u.subs.length > 0)).toBe(true);
  });

  it("reconstruit l'arbre à deux niveaux sans le formulaire", () => {
    const tree = buildUsageTree(usages);

    expect(tree.length).toBeGreaterThan(0);
    expect(tree.some((c) => c.children.length > 0)).toBe(true);
    // Les libellés déduits sont lisibles, jamais des slugs bruts.
    expect(tree.every((c) => !c.label.includes("-") && !/^\d/.test(c.label))).toBe(true);
  });

  it("tolère la sous-catégorie homonyme portée par deux catégories", () => {
    // `2_site-vitrine` et `10_site-vitrine` coexistent : indexer les enfants
    // globalement les confondrait.
    const tree = buildUsageTree(usages);
    const allSubIds = tree.flatMap((c) => c.children.map((s) => `${c.id}/${s.id}`));
    expect(new Set(allSubIds).size).toBe(allSubIds.length);
  });
});
