import { describe, expect, it } from "vitest";
import { apiMethodForType, isResolvableType, TYPES_REQUIRING_HOST } from "./resolveTarget";
import { COMMENTABLE_TYPES } from "../types";

describe("résolution d'une cible en entité", () => {
  it("couvre exactement les types que `api` sait charger seul", () => {
    const resolubles = COMMENTABLE_TYPES.filter(isResolvableType);
    expect([...resolubles].sort()).toEqual(
      ["answers", "citoyens", "classifieds", "events", "forms", "organizations", "poi", "projects"].sort(),
    );
  });

  it("laisse de côté news et actions, qui exigent une entité porteuse", () => {
    expect(apiMethodForType("news")).toBeNull();
    expect(apiMethodForType("actions")).toBeNull();
    expect([...TYPES_REQUIRING_HOST].sort()).toEqual(["actions", "news"]);
  });

  it("associe `citoyens` à `user`, et non à un nom deviné", () => {
    expect(apiMethodForType("citoyens")).toBe("user");
    expect(apiMethodForType("poi")).toBe("poi");
    expect(apiMethodForType("organizations")).toBe("organization");
  });

  it("partitionne les dix types sans reste", () => {
    const resolubles = COMMENTABLE_TYPES.filter(isResolvableType).length;
    expect(resolubles + TYPES_REQUIRING_HOST.length).toBe(COMMENTABLE_TYPES.length);
  });
});
