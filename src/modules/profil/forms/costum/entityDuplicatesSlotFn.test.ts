import { describe, it, expect } from "vitest";
import "../registerSpecFns";
import { getSlotFn } from "../specRegistries";
import type { EntityModalSpec } from "../entityModalSpec";

/**
 * Le même formulaire sert la création ET l'édition (`add-<id>` / `edit-<id>`) : c'est la SlotFn qui
 * rend le slot inerte en édition — le moteur, lui, ne distingue pas les deux modes.
 */
const spec = {
  id: "tiers-lieux",
  duplicateCheck: { nameField: "name", search: { types: ["organizations"] } },
} as unknown as EntityModalSpec;

describe("slot:entityDuplicates", () => {
  const slot = getSlotFn("slot:entityDuplicates");

  it("est fourni par le barrel commun", () => {
    expect(slot).toBeTypeOf("function");
  });

  it("rend un élément en création, avec un bloc duplicateCheck", () => {
    expect(slot?.({ mode: "add" }, spec)).not.toBeNull();
  });

  it("est inerte en édition", () => {
    expect(slot?.({ mode: "edit" }, spec)).toBeNull();
  });

  it("est inerte sans bloc duplicateCheck (slot posé, paramètres oubliés)", () => {
    expect(slot?.({ mode: "add" }, { id: "x" } as unknown as EntityModalSpec)).toBeNull();
    expect(slot?.({ mode: "add" })).toBeNull();
  });
});
