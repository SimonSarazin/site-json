/**
 * Garde de la table runtime des modales costum + garde du loader JSON. Les 2 costums (equipements-sportifs,
 * tiers-lieux) ont leur SOURCE en JSON de config (`config.prod.*.json`) ; ils sont chargés via la voie UNIQUE
 * `registerCostumForm` (la même qu'au runtime via window.__CONFIG__). Plus aucun schema/spec/descriptor TS.
 */
import { describe, it, expect } from "vitest";
import { getCostumModalSpec, registerCostumForm } from "./costumFormRegistry";
import { loadCostumForm, costumDoc } from "./__fixtures__/configCostum";

const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const IDS = ["equipements-sportifs", "tiers-lieux"] as const;

describe("costumFormRegistry — table runtime des modales costum", () => {
  it("résolution par id (source = JSON config, voie registerCostumForm)", () => {
    for (const id of IDS) {
      const { spec } = loadCostumForm(id); // enregistre via le document JSON de config
      expect(getCostumModalSpec(id)).toBe(spec);
    }
    expect(getCostumModalSpec("inconnu")).toBeUndefined();
  });

  it("registerCostumForm(JSON config) compile une spec stable (re-compile byte-identique)", () => {
    for (const id of IDS) {
      const a = registerCostumForm(costumDoc(id)).spec;
      const b = registerCostumForm(costumDoc(id)).spec;
      expect(a.id).toBe(id);
      expect(norm(a)).toEqual(norm(b));
    }
  });

  it("registerCostumForm REJETTE un document malformé (zod) avec un message clair", () => {
    // manque fields/sections/chrome/mutation → erreur de validation, pas un crash au rendu.
    expect(() => registerCostumForm({ id: "x", entityType: "poi" } as never)).toThrow(/document costum invalide.*id=x/s);
    // fields sans widget → invalide aussi.
    const bad = { ...JSON.parse(JSON.stringify(costumDoc("tiers-lieux"))), fields: { name: { label: "x" } } };
    expect(() => registerCostumForm(bad as never)).toThrow(/invalide/);
  });

  it("registerCostumForm REJETTE une clé de registre NON enregistrée (garde du loader)", () => {
    // Structure valide (passe zod) MAIS payloadFn pointe une clé inexistante → erreur claire au load,
    // pas un console.warn silencieux au rendu. (Les autres clés tl:* sont enregistrées par registerSpecFns.)
    const bad = JSON.parse(JSON.stringify(costumDoc("tiers-lieux")));
    bad.id = "tiers-lieux-cle-fantome";
    bad.mutation.payloadFn = "tl:CLE_INEXISTANTE";
    expect(() => registerCostumForm(bad)).toThrow(/NON ENREGISTR.*payloadFn:"tl:CLE_INEXISTANTE"/s);
  });
});
