/**
 * GARDE byte-parité STRUCTURELLE (tiers-lieu) : fige (snapshot) le descripteur ET la spec tels qu'AUJOURD'HUI
 * (hand-written) ; après bascule sur le document fusionné `schema.ts` (via `compileCostumSchema`), ces
 * snapshots doivent rester IDENTIQUES. Normalisé (JSON round-trip) pour ignorer les `undefined`. cf. poi.
 */
import { describe, it, expect } from "vitest";
import { tiersLieuxDescriptor } from "./descriptor";
import { tiersLieuxSpec } from "./spec";
import "./fns";

const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("tiers-lieu — byte-parité structurelle (descriptor + spec)", () => {
  it("descripteur figé (snapshot)", () => {
    expect(norm(tiersLieuxDescriptor)).toMatchSnapshot();
  });
  it("spec figée (snapshot)", () => {
    expect(norm(tiersLieuxSpec)).toMatchSnapshot();
  });
});
