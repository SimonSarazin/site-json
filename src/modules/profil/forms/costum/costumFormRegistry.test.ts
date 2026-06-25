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
});
