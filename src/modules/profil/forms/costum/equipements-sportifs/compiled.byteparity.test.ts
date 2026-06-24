/**
 * GARDE byte-parité STRUCTURELLE du pilote « fusion form+modal » : fige (snapshot) le descripteur ET la spec
 * du costum poi-équipement tels qu'ils sont AUJOURD'HUI (construits à la main). Quand on bascule leur SOURCE
 * sur le document fusionné `schema.ts` (via `compileCostumSchema`), ces snapshots doivent rester IDENTIQUES —
 * preuve que le compilateur reproduit byte-pour-byte la structure (champs/read/write/default/sections/spec).
 * Normalisé (JSON round-trip) pour ignorer les `undefined` (clés absentes ≡ undefined). cf. plan fusion.
 */
import { describe, it, expect } from "vitest";
import { equipementsSportifsDescriptor } from "./descriptor";
import { equipementsSportifsSpec } from "./spec";
import "./fns"; // enregistre les transforms référencés par clé (pas requis pour le snapshot, mais cohérent)

const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("poi-équipement — byte-parité structurelle (descriptor + spec)", () => {
  it("descripteur figé (snapshot)", () => {
    expect(norm(equipementsSportifsDescriptor)).toMatchSnapshot();
  });
  it("spec figée (snapshot)", () => {
    expect(norm(equipementsSportifsSpec)).toMatchSnapshot();
  });
});
