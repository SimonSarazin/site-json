/**
 * Garde de la table runtime des modales costum + GARDE ANTI-DRIFT du futur loader JSON : recompiler le SCHÉMA
 * (voie loader, `registerCostumForm`) doit produire EXACTEMENT la même spec que le module TS `spec.ts`. Tant
 * que c'est vrai, poser un costum en JSON dans `config.costumForms` donnera un comportement identique au TS.
 */
import { describe, it, expect } from "vitest";
import { getCostumModalSpec, registerCostumForm } from "./costumFormRegistry";
import { equipementsSportifsSpec } from "./equipements-sportifs/spec"; // s'auto-enregistre dans la table
import { tiersLieuxSpec } from "./tiers-lieux/spec"; // s'auto-enregistre
import { EQUIPEMENTS_SPORTIFS_SCHEMA } from "./equipements-sportifs/schema";
import { TIERS_LIEUX_SCHEMA } from "./tiers-lieux/schema";
import "./equipements-sportifs/fns"; // enregistre les clés référencées (cohérence boot)
import "./tiers-lieux/fns";

const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("costumFormRegistry — table runtime des modales costum", () => {
  it("les spec.ts s'auto-enregistrent → résolution par id", () => {
    expect(getCostumModalSpec("equipements-sportifs")).toBe(equipementsSportifsSpec);
    expect(getCostumModalSpec("tiers-lieux")).toBe(tiersLieuxSpec);
    expect(getCostumModalSpec("inconnu")).toBeUndefined();
  });

  it("registerCostumForm(schema) (voie loader JSON) reproduit la spec du module TS — byte", () => {
    expect(norm(registerCostumForm(EQUIPEMENTS_SPORTIFS_SCHEMA).spec)).toEqual(norm(equipementsSportifsSpec));
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
