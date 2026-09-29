import { describe, it, expect } from "vitest";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { candidatePlace, duplicateHintKey, duplicateLevel, isSearchableName, rankDuplicates, stillRelevant, strongestDuplicate, toDuplicateCandidate } from "./entityDuplicates";

/**
 * Le niveau décide de ce que l'utilisateur voit (simple information, alerte, confirmation à la
 * création). Cas réels du réseau : « La Plume à loup » saisi alors que « La Plume à Loup » existe
 * à Attin (62170) ; « L'Archipel », six lieux distincts dans six villes.
 */
/** Entité de recherche minimale : seuls `id`, `slug` et `serverData` sont lus par la logique testée. */
const asEntity = (value: unknown) => value as SearchEntity;
const ent = (id: string, name: string, postalCode?: string, locality?: string) =>
  asEntity({ id, slug: id, serverData: { name, slug: id, collection: "organizations", address: { postalCode, addressLocality: locality } } });

describe("isSearchableName", () => {
  it("exige 3 caractères UTILES (repliés), pas 3 frappes", () => {
    expect(isSearchableName("La")).toBe(false);
    expect(isSearchableName(" - ")).toBe(false);
    expect(isSearchableName("Lab")).toBe(true);
    expect(isSearchableName("é é")).toBe(true);
    expect(isSearchableName(undefined)).toBe(false);
  });
});

describe("toDuplicateCandidate", () => {
  it("lit id, nom, slug et adresse ; ignore une entité sans nom", () => {
    expect(toDuplicateCandidate(ent("a1", "La Plume à Loup", "62170", "ATTIN"))).toEqual({
      id: "a1", name: "La Plume à Loup", slug: "a1", postalCode: "62170", locality: "ATTIN",
    });
    expect(toDuplicateCandidate(asEntity({ id: "a2", serverData: {} }))).toBeNull();
    expect(toDuplicateCandidate(null)).toBeNull();
  });

  it("retrouve id et slug dans le document quand l'instance ne les porte pas", () => {
    const c = toDuplicateCandidate(asEntity({ serverData: { id: "abc", slug: "laPlume", name: "X" } }));
    expect(c?.id).toBe("abc");
    expect(c?.slug).toBe("laPlume");
  });

  it("accepte un code postal numérique", () => {
    expect(toDuplicateCandidate(asEntity({ id: "a", serverData: { name: "X", address: { postalCode: 97430 } } }))?.postalCode).toBe("97430");
  });
});

describe("duplicateLevel", () => {
  const plume = { id: "a1", name: "La Plume à Loup", postalCode: "62170" };

  it("même nom replié + même code postal → strong", () => {
    expect(duplicateLevel({ name: "la plume a loup", postalCode: "62170" }, plume)).toEqual({ level: "strong", sameName: true, samePostalCode: true });
  });

  it("même nom, code postal pas encore saisi → likely (on ne sait pas encore)", () => {
    expect(duplicateLevel({ name: "La Plume à loup" }, plume)?.level).toBe("likely");
  });

  it("même nom, autre commune → likely (« L'Archipel » existe dans six villes)", () => {
    expect(duplicateLevel({ name: "La Plume à Loup", postalCode: "75011" }, plume)).toEqual({ level: "likely", sameName: true, samePostalCode: false });
  });

  it("nom approchant dans la même commune → likely", () => {
    expect(duplicateLevel({ name: "Plume", postalCode: "62170" }, plume)).toEqual({ level: "likely", sameName: false, samePostalCode: true });
  });

  it("nom approchant seul → possible", () => {
    expect(duplicateLevel({ name: "Plume" }, plume)?.level).toBe("possible");
  });

  it("deux codes postaux absents ne « coïncident » pas", () => {
    expect(duplicateLevel({ name: "Plume", postalCode: "" }, { id: "x", name: "La Plume" })?.samePostalCode).toBe(false);
  });

  it("saisie sans nom exploitable → null", () => {
    expect(duplicateLevel({ name: "  " }, plume)).toBeNull();
  });
});

describe("rankDuplicates", () => {
  const found = [
    ent("p1", "La Plume d'or", "75011", "PARIS"),       // possible
    ent("p2", "La Plume à Loup", "59000", "LILLE"),     // likely (même nom, autre CP)
    ent("p3", "La Plume à Loup", "62170", "ATTIN"),     // strong
    ent("p4", "Plume et compagnie", "62170", "ATTIN"),  // likely (même CP)
    ent("p5", "", "62170"),                             // sans nom → écartée
  ];
  const input = { name: "la plume a loup", postalCode: "62170" };

  it("classe strong > likely > possible en gardant l'ordre de la recherche dans chaque niveau", () => {
    expect(rankDuplicates(input, found).map((r) => `${r.candidate.id}:${r.level}`)).toEqual([
      "p3:strong", "p2:likely", "p4:likely", "p1:possible",
    ]);
  });

  it("borne à `limit` APRÈS le classement (le plus probant n'est jamais coupé)", () => {
    expect(rankDuplicates(input, found, { limit: 1 }).map((r) => r.candidate.id)).toEqual(["p3"]);
  });

  it("écarte l'entité en cours d'édition et les répétitions d'id", () => {
    const ids = rankDuplicates(input, [...found, found[2]], { excludeId: "p2" }).map((r) => r.candidate.id);
    expect(ids).toEqual(["p3", "p4", "p1"]);
  });

  it("strongestDuplicate ne rend que du strong", () => {
    expect(strongestDuplicate(rankDuplicates(input, found))?.candidate.id).toBe("p3");
    expect(strongestDuplicate(rankDuplicates({ name: "la plume a loup" }, found))).toBeUndefined();
  });
});

describe("candidatePlace / duplicateHintKey — ce que l'utilisateur lit", () => {
  it("situe la fiche en une ligne, et rend une chaîne vide sans adresse", () => {
    expect(candidatePlace({ postalCode: "62170", locality: "ATTIN" })).toBe("62170 ATTIN");
    expect(candidatePlace({ locality: "ATTIN" })).toBe("ATTIN");
    expect(candidatePlace({})).toBe("");
  });

  it("nomme l'indice qui a fait remonter la correspondance ; rien pour un nom seulement approchant", () => {
    expect(duplicateHintKey({ sameName: true, samePostalCode: true })).toBe("EntityDuplicates.hint.sameNameSamePostalCode");
    expect(duplicateHintKey({ sameName: true, samePostalCode: false })).toBe("EntityDuplicates.hint.sameName");
    expect(duplicateHintKey({ sameName: false, samePostalCode: true })).toBe("EntityDuplicates.hint.samePostalCode");
    expect(duplicateHintKey({ sameName: false, samePostalCode: false })).toBeNull();
  });
});

describe("stillRelevant — résultats d'un nom précédent", () => {
  const held = [ent("p1", "La Plume d'or"), ent("p2", "La Plume à Loup"), ent("p3", "Plume")];

  it("garde ce qui contient la saisie, ou que la saisie contient", () => {
    expect(stillRelevant("La Plume à", held).map((e) => e.id)).toEqual(["p2", "p3"]);
    expect(stillRelevant("plume", held).map((e) => e.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("écarte tout pour un nom sans rapport, ou une saisie vide", () => {
    expect(stillRelevant("Zèbre", held)).toEqual([]);
    expect(stillRelevant("  ", held)).toEqual([]);
  });
});

