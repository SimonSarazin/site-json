import { describe, it, expect } from "vitest";

import { buildLinkedEntitiesFilter } from "./useLinkedEntitiesQuery";

describe("buildLinkedEntitiesFilter — portage du filtre legacy Agenda/Projets", () => {
  it("un $or EN OBJET (pas en tableau — le DSL Communecter refuse le tableau, cf. commentaire)", () => {
    expect(buildLinkedEntitiesFilter(["a", "b"], ["links.attendees", "links.organizer"])).toEqual({
      $or: {
        "links.attendees.a": { $exists: true },
        "links.organizer.a": { $exists: true },
        "links.attendees.b": { $exists: true },
        "links.organizer.b": { $exists: true },
      },
    });
  });

  it("un seul champ de lien (projets : links.contributors)", () => {
    expect(buildLinkedEntitiesFilter(["a"], ["links.contributors"])).toEqual({
      $or: { "links.contributors.a": { $exists: true } },
    });
  });

  it("aucune organisation → $or vide (ne matche jamais TOUT par accident)", () => {
    expect(buildLinkedEntitiesFilter([], ["links.attendees"])).toEqual({ $or: {} });
  });

  it("le résultat n'est jamais un tableau — régression du bug MongoException", () => {
    const filtre = buildLinkedEntitiesFilter(["a"], ["links.attendees"]);
    expect(Array.isArray((filtre as { $or: unknown }).$or)).toBe(false);
  });
});
