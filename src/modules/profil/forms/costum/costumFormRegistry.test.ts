/**
 * Garde de la table runtime des modales costum + garde du loader JSON.
 * - equipements-sportifs : SOURCE = document JSON de config (`config.prod`), chargé via la voie unique
 *   `registerCostumForm` (plus de schema/spec/descriptor TS). On vérifie résolution par id + compilation stable.
 * - tiers-lieux : encore en TS → garde ANTI-DRIFT `registerCostumForm(SCHEMA) ≡ spec TS` (sera migré en phase 2).
 */
import { describe, it, expect } from "vitest";
import { getCostumModalSpec, registerCostumForm } from "./costumFormRegistry";
import { tiersLieuxSpec } from "./tiers-lieux/spec"; // s'auto-enregistre (tiers-lieux encore en TS)
import { TIERS_LIEUX_SCHEMA } from "./tiers-lieux/schema";
import { loadCostumForm, costumDoc } from "./__fixtures__/configCostum"; // equipements : source = JSON config
import "./tiers-lieux/fns"; // cohérence boot (clés tiers-lieux)

const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("costumFormRegistry — table runtime des modales costum", () => {
  it("résolution par id (equipements = JSON config, tiers-lieux = TS)", () => {
    const equip = loadCostumForm("equipements-sportifs"); // enregistre via le document JSON de config
    expect(getCostumModalSpec("equipements-sportifs")).toBe(equip.spec);
    expect(getCostumModalSpec("tiers-lieux")).toBe(tiersLieuxSpec);
    expect(getCostumModalSpec("inconnu")).toBeUndefined();
  });

  it("registerCostumForm : compilation stable (equipements, JSON) ; reproduit la spec TS (tiers-lieux, byte)", () => {
    // equipements : la source EST le JSON → on vérifie que la voie loader compile la spec attendue + de façon stable.
    const a = registerCostumForm(costumDoc("equipements-sportifs")).spec;
    const b = registerCostumForm(costumDoc("equipements-sportifs")).spec;
    expect(a.id).toBe("equipements-sportifs");
    expect(norm(a)).toEqual(norm(b));
    // tiers-lieux : encore en TS → garde anti-drift loader≡TS (byte). (phase 2 : passera au JSON.)
    expect(norm(registerCostumForm(TIERS_LIEUX_SCHEMA).spec)).toEqual(norm(tiersLieuxSpec));
  });

  it("registerCostumForm REJETTE un document malformé (zod) avec un message clair", () => {
    // manque fields/sections/chrome/mutation → erreur de validation, pas un crash au rendu.
    expect(() => registerCostumForm({ id: "x", entityType: "poi" } as never)).toThrow(/document costum invalide.*id=x/s);
    // fields sans widget → invalide aussi.
    const bad = { ...JSON.parse(JSON.stringify(TIERS_LIEUX_SCHEMA)), fields: { name: { label: "x" } } };
    expect(() => registerCostumForm(bad as never)).toThrow(/invalide/);
  });

  it("registerCostumForm REJETTE une clé de registre NON enregistrée (garde du loader)", () => {
    // Structure valide (passe zod) MAIS payloadFn pointe une clé inexistante → erreur claire au load,
    // pas un console.warn silencieux au rendu. (Les autres clés tl:* sont enregistrées par les fns importées.)
    const bad = JSON.parse(JSON.stringify(TIERS_LIEUX_SCHEMA));
    bad.id = "tiers-lieux-cle-fantome";
    bad.mutation.payloadFn = "tl:CLE_INEXISTANTE";
    expect(() => registerCostumForm(bad)).toThrow(/NON ENREGISTR.*payloadFn:"tl:CLE_INEXISTANTE"/s);
  });
});
