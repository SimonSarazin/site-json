import { describe, it, expect } from "vitest";

import { buildMyOrgaFilter, buildAllPaths, extractOrgNames } from "./useSimilarPlacesQuery";

// `buildAllPaths` prend des objets ORGANISATION BRUTS (pas des instances `Organization` du SDK) —
// cf. le commentaire du hook : `Organization._transformServerData` réécrirait `.answers` avant qu'on
// puisse le lire, d'où l'appel endpoint direct qui produit ces objets bruts en amont.
const orgAvecReponses = (id: string, answers: Record<string, unknown>): Record<string, unknown> =>
  ({ id, answers: { answers } });

describe("buildMyOrgaFilter — portage EXACT de myOrga.myOrgaFilter (listOrga.php:83-88)", () => {
  it("$or objet : _id $in les lieux membres, OU un vote du compte connecté", () => {
    expect(buildMyOrgaFilter(["a", "b"], "user-1")).toEqual({
      $or: { _id: { $in: ["a", "b"] }, "vote.user-1": { $exists: true } },
    });
  });

  it("l'id du compte est DYNAMIQUE — pas un id de critère figé", () => {
    const f1 = buildMyOrgaFilter(["a"], "user-1");
    const f2 = buildMyOrgaFilter(["a"], "user-2");
    expect(f1).not.toEqual(f2);
    expect(Object.keys((f1.$or as Record<string, unknown>))).toContain("vote.user-1");
    expect(Object.keys((f2.$or as Record<string, unknown>))).toContain("vote.user-2");
  });
});

describe("buildAllPaths — portage de listOrga.php:279-297, bug legacy INCLUS (dernière org gagne, pas d'union)", () => {
  it("un champ tableau devient un tableau dédupliqué, keyé par le VALUEPATH complet", () => {
    const orgs = [
      orgAvecReponses("1", {
        franceTierslieux1522023_146_2: {
          multiCheckboxPlusfranceTierslieux1522023_146_2le5osg2xb6hjxhv95op: ["a", "b", "a"],
        },
      }),
    ];
    const allPaths = buildAllPaths(orgs);
    expect(allPaths["answers.franceTierslieux1522023_146_2.multiCheckboxPlusfranceTierslieux1522023_146_2le5osg2xb6hjxhv95op"]).toEqual(["a", "b"]);
  });

  it("un champ chaîne est repris tel quel ($eq côté serveur)", () => {
    const orgs = [
      orgAvecReponses("1", {
        franceTierslieux1922023_1231_5: { franceTierslieux1922023_1231_5lebb61gowlj39f2a2e: "valeur" },
      }),
    ];
    const allPaths = buildAllPaths(orgs);
    expect(allPaths["answers.franceTierslieux1922023_1231_5.franceTierslieux1922023_1231_5lebb61gowlj39f2a2e"]).toBe("valeur");
  });

  it("bug legacy reproduit : la DERNIÈRE org portant une réponse à un chemin écrase les précédentes (pas d'union)", () => {
    const champ = { franceTierslieux1922023_1231_5: { franceTierslieux1922023_1231_5lebb61gowlj39f2a2e: "org-1" } };
    const champ2 = { franceTierslieux1922023_1231_5: { franceTierslieux1922023_1231_5lebb61gowlj39f2a2e: "org-2" } };
    const allPaths = buildAllPaths([orgAvecReponses("1", champ), orgAvecReponses("2", champ2)]);
    expect(allPaths["answers.franceTierslieux1922023_1231_5.franceTierslieux1922023_1231_5lebb61gowlj39f2a2e"]).toBe("org-2");
  });

  it("une org sans `answers.answers` est ignorée sans faire échouer la construction", () => {
    const sansReponses = { id: "1" };
    expect(buildAllPaths([sansReponses])).toEqual({});
  });

  it("aucune org → allPaths vide", () => {
    expect(buildAllPaths([])).toEqual({});
  });

  it("une valeur ni tableau ni chaîne (nombre, objet) est ignorée — même filtre que le PHP (is_array/is_string)", () => {
    const orgs = [
      orgAvecReponses("1", {
        franceTierslieux1922023_1231_5: { franceTierslieux1922023_1231_5lebb61gowlj39f2a2e: 42 },
      }),
    ];
    expect(buildAllPaths(orgs)).toEqual({});
  });
});

describe("extractOrgNames — portage de listOrga.php:315-320", () => {
  it("extrait le nom de la PREMIÈRE organisation de links.organizations par résultat", () => {
    const profileResults = [
      { links: { organizations: { "id-1": { name: "La Plume à Loup" } } } },
      { links: { organizations: { "id-2": { name: "Kiltir Lab" } } } },
    ];
    expect(extractOrgNames(profileResults)).toEqual(["La Plume à Loup", "Kiltir Lab"]);
  });

  it("un résultat sans links.organizations est ignoré, sans faire échouer les autres", () => {
    const profileResults = [{ user: "x" }, { links: { organizations: { "id-1": { name: "Kiltir Lab" } } } }];
    expect(extractOrgNames(profileResults)).toEqual(["Kiltir Lab"]);
  });

  it("liste vide → liste vide", () => {
    expect(extractOrgNames([])).toEqual([]);
  });
});
