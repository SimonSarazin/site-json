import { describe, it, expect } from "vitest";
import { buildResourceDirectoryBaseParams } from "./useResourceDirectoryItems";

const resourceTypes = [
  { id: "coworking", kind: "coworking", formId: "F1", stepPrefix: "s1", label: { fr: "Coworking" } },
] as never;

describe("buildResourceDirectoryBaseParams", () => {
  it("réponses des formulaires déclarés, champs de l'éclatement serveur, tout l'annuaire d'un coup", () => {
    const p = buildResourceDirectoryBaseParams({ resourceTypes, finderSuffix: "FIND", costumSlug: "c", contextId: "x", contextType: "projects" });
    expect(p).toMatchObject({
      defaultTypes: ["answers"],
      defaultFields: ["name", "description", "answers", "collection", "form"],
      indexStepList: 500,
      notSourceKey: true,
      costumSlug: "c",
      contextId: "x",
      contextType: "projects",
    });
    expect((p.defaultFilters as Record<string, unknown>).form).toEqual({ $in: ["F1"] });
  });

  it("garde de zone et limite reportées ; limite plafonnée à 500", () => {
    const p = buildResourceDirectoryBaseParams({ resourceTypes, finderSuffix: "FIND", scope: { addressLevel1: "Z" }, limit: 5 });
    expect(p.indexStepList).toBe(5);
    expect((p.defaultFilters as Record<string, unknown>)["address.level1"]).toBe("Z");
    expect(buildResourceDirectoryBaseParams({ resourceTypes, finderSuffix: "FIND", limit: 900 }).indexStepList).toBe(500);
  });

  it("sans costum ni contexte : aucune clé vide envoyée", () => {
    const p = buildResourceDirectoryBaseParams({ resourceTypes, finderSuffix: "FIND" });
    expect(p).not.toHaveProperty("costumSlug");
    expect(p).not.toHaveProperty("contextId");
  });
});
