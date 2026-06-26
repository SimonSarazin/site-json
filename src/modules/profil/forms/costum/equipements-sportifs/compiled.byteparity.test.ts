/**
 * GARDE byte-parité STRUCTURELLE du costum poi-équipement : fige (snapshot) le descripteur ET la spec COMPILÉS
 * depuis le document JSON `config.prod.equipements-Sportifs.json` (`costumForms.equipements-sportifs`) via la
 * voie unique `registerCostumForm`. Toute dérive de la config (ou du compilateur) casse le snapshot.
 * Normalisé (JSON round-trip) pour ignorer les `undefined` (clés absentes ≡ undefined).
 *
 * NB : le snapshot a été capturé du temps où la source était le `schema.ts` TS ; il reste IDENTIQUE car le JSON
 * est byte-fidèle au schema (le compilé est le même) → preuve que la config produit exactement la même structure.
 */
import { describe, it, expect } from "vitest";
import { loadCostumForm } from "../__fixtures__/configCostum";

const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const { descriptor, spec } = loadCostumForm("equipements-sportifs");

describe("poi-équipement — byte-parité structurelle (descriptor + spec)", () => {
  it("descripteur figé (snapshot)", () => {
    expect(norm(descriptor)).toMatchSnapshot();
  });
  it("spec figée (snapshot)", () => {
    expect(norm(spec)).toMatchSnapshot();
  });
});
