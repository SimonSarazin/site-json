import { describe, expect, it } from "vitest";
import { calculateActionDiff, type DiffActionPrevious, type DiffActionNext } from "./actionDiffCalculator";

/**
 * Helper de formatage de date utilisé par le calculateur dans les tests.
 * En vrai code c'est `timestampToFrenchDate` ; ici on fait simple pour rester pur.
 */
function formatTimestampToFrenchDate(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

const basePrevious: DiffActionPrevious = {
  name: "OriginalName",
  credits: 10,
  status: "todo",
  tags: ["tag1", "tag2"],
  contributors: [{ id: "user1", name: "Alice" }],
  date_start: undefined,
  date_end: undefined,
};

const baseNext: DiffActionNext = {
  name: "OriginalName",
  credits: 10,
  status: "todo",
  tags: ["tag1", "tag2"],
  contributors: [{ id: "user1", type: "citoyens", name: "Alice" }],
  startDate: "",
  endDate: "",
};

describe("calculateActionDiff", () => {
  it("retourne {} si aucun champ n'a changé", () => {
    expect(
      calculateActionDiff({
        previous: basePrevious,
        next: baseNext,
        formatTimestampToFrenchDate,
      }),
    ).toEqual({});
  });

  it("détecte un changement de name", () => {
    const diff = calculateActionDiff({
      previous: basePrevious,
      next: { ...baseNext, name: "NewName" },
      formatTimestampToFrenchDate,
    });
    expect(diff).toEqual({ name: "NewName" });
  });

  it("détecte un changement de credits", () => {
    const diff = calculateActionDiff({
      previous: basePrevious,
      next: { ...baseNext, credits: 50 },
      formatTimestampToFrenchDate,
    });
    expect(diff).toEqual({ credits: 50 });
  });

  it("détecte un changement de status", () => {
    const diff = calculateActionDiff({
      previous: basePrevious,
      next: { ...baseNext, status: "done" },
      formatTimestampToFrenchDate,
    });
    expect(diff).toEqual({ status: "done" });
  });

  it("détecte un changement de tags (ajout)", () => {
    const diff = calculateActionDiff({
      previous: basePrevious,
      next: { ...baseNext, tags: ["tag1", "tag2", "tag3"] },
      formatTimestampToFrenchDate,
    });
    expect(diff).toEqual({ tags: ["tag1", "tag2", "tag3"] });
  });

  it("détecte un changement de contributors (ajout) avec links.contributors construit", () => {
    const diff = calculateActionDiff({
      previous: basePrevious,
      next: {
        ...baseNext,
        contributors: [
          { id: "user1", type: "citoyens", name: "Alice" },
          { id: "user2", type: "citoyens", name: "Bob" },
        ],
      },
      formatTimestampToFrenchDate,
    });
    expect(diff).toEqual({
      "links.contributors": {
        user1: { type: "citoyens", isAdmin: true, name: "Alice" },
        user2: { type: "citoyens", isAdmin: true, name: "Bob" },
      },
    });
  });

  it("fallback : contributor ID utilisé comme nom si pas de name fourni ET introuvable dans previous", () => {
    const diff = calculateActionDiff({
      previous: basePrevious,
      next: {
        ...baseNext,
        contributors: [
          { id: "user1", type: "citoyens" },
          { id: "unknownUser", type: "citoyens" },
        ],
      },
      formatTimestampToFrenchDate,
    });
    expect(diff["links.contributors"]).toEqual({
      user1: { type: "citoyens", isAdmin: true, name: "Alice" },
      unknownUser: { type: "citoyens", isAdmin: true, name: "unknownUser" },
    });
  });

  it("supporte le type 'organizations' pour un contributeur organisation", () => {
    const diff = calculateActionDiff({
      previous: basePrevious,
      next: {
        ...baseNext,
        contributors: [
          { id: "user1", type: "citoyens", name: "Alice" },
          { id: "org1", type: "organizations", name: "OrgA" },
        ],
      },
      formatTimestampToFrenchDate,
    });
    expect(diff["links.contributors"]).toEqual({
      user1: { type: "citoyens", isAdmin: true, name: "Alice" },
      org1: { type: "organizations", isAdmin: true, name: "OrgA" },
    });
  });

  it("normalise les contributors (dedup + sort) avant compare", () => {
    // Doublon sur le même id → après dedup, identique au previous
    const diff = calculateActionDiff({
      previous: basePrevious,
      next: {
        ...baseNext,
        contributors: [
          { id: "user1", type: "citoyens", name: "Alice" },
          { id: "user1", type: "citoyens", name: "Alice" },
        ],
      },
      formatTimestampToFrenchDate,
    });
    expect(diff).toEqual({});
  });

  it("détecte un changement de startDate (ajout depuis vide)", () => {
    const diff = calculateActionDiff({
      previous: basePrevious,
      next: { ...baseNext, startDate: "15/03/2025" },
      formatTimestampToFrenchDate,
    });
    expect(diff).toEqual({ startDate: "15/03/2025" });
  });

  it("détecte la suppression d'une endDate (vide alors qu'il y avait un timestamp)", () => {
    const previous: DiffActionPrevious = {
      ...basePrevious,
      date_end: new Date(2025, 5, 15).getTime(), // 15/06/2025
    };
    const diff = calculateActionDiff({
      previous,
      next: { ...baseNext, endDate: "" },
      formatTimestampToFrenchDate,
    });
    expect(diff).toEqual({ endDate: null });
  });

  it("combine plusieurs changements en un seul objet", () => {
    const diff = calculateActionDiff({
      previous: basePrevious,
      next: {
        ...baseNext,
        name: "Renamed",
        credits: 99,
        status: "done",
        startDate: "01/01/2025",
      },
      formatTimestampToFrenchDate,
    });
    expect(diff).toEqual({
      name: "Renamed",
      credits: 99,
      status: "done",
      startDate: "01/01/2025",
    });
  });
});
