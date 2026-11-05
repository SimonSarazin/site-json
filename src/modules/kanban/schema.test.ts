import { describe, expect, test } from "vitest";
import { KanbanConfigSchema } from "./schema";

describe("KanbanConfigSchema", () => {
  test("un bloc vide active les deux kanbans", () => {
    expect(KanbanConfigSchema.parse({})).toEqual({});
  });

  test("`boards` restreint et ordonne", () => {
    expect(KanbanConfigSchema.parse({ boards: ["roles"] })).toEqual({ boards: ["roles"] });
    expect(KanbanConfigSchema.parse({ boards: ["roles", "actions"] })).toEqual({ boards: ["roles", "actions"] });
  });

  test("refuse un type inconnu, une liste vide ou un doublon", () => {
    expect(KanbanConfigSchema.safeParse({ boards: ["projets"] }).success).toBe(false);
    expect(KanbanConfigSchema.safeParse({ boards: [] }).success).toBe(false);
    expect(KanbanConfigSchema.safeParse({ boards: ["actions", "actions"] }).success).toBe(false);
  });
});
