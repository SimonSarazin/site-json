/**
 * GARDE byte-parité STRUCTURELLE (tiers-lieu) : fige (snapshot) le descripteur ET la spec COMPILÉS depuis le
 * document JSON `config.prod.tiers-lieux.json` (`costumForms.tiers-lieux`) via la voie unique `registerCostumForm`.
 * Le snapshot a été capturé du temps où la source était le `schema.ts` TS ; il reste IDENTIQUE car le JSON est
 * byte-fidèle au schema. Normalisé (JSON round-trip) pour ignorer les `undefined`.
 */
import { describe, it, expect } from "vitest";
import { loadCostumForm } from "../__fixtures__/configCostum";

const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const { descriptor: tiersLieuxDescriptor, spec: tiersLieuxSpec } = loadCostumForm("tiers-lieux");

describe("tiers-lieu — byte-parité structurelle (descriptor + spec)", () => {
  it("descripteur figé (snapshot)", () => {
    expect(norm(tiersLieuxDescriptor)).toMatchSnapshot();
  });
  it("spec figée (snapshot)", () => {
    expect(norm(tiersLieuxSpec)).toMatchSnapshot();
  });
});
