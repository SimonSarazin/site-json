/**
 * Garde de régression du bug "création d'article parent62 rejetée (ADD_POI /type)". Cause : le costum form
 * config-driven `parent62-article` déclarait `costumSlug:"parent62"` MAIS pas de `scope` → `resolveCostumSlug`
 * renvoyait undefined → le save UI tombait sur le scope AMBIANT fieldless (`me.costum(<org>)`, presets vides)
 * au lieu du scope SLUG (`me.costum("parent62")`, presets={type:"article"}) → le champ forcé `type:"article"`
 * n'était jamais relâché dans l'enveloppe → enum ADD_POI. Fix data-driven : `scope:{slugFrom:"constant",
 * constant:"parent62"}` (même patron que tiers-lieux / equipements-sportifs). Ce test compile la VRAIE config
 * et prouve que le save ADD résout bien `costumSlug="parent62"`.
 */
import { describe, it, expect } from "vitest";

import "../registerSpecFns"; // clés fns (générique + métier, dont invalidate:blog) AVANT compile
import { registerCostumForm } from "./costumFormRegistry";
import { specToConfig } from "../resolveModalSpec";
import type { EntityModalCtx } from "../entityModalSpec";
import type { CostumFormSchema } from "./compileCostumSchema";

import parent62 from "../../../../../config.prod.parent62.json";

const doc = (parent62 as { costumForms: Record<string, CostumFormSchema> }).costumForms["parent62-article"];

describe("parent62-article — scope constant → costumSlug résolu (fix article)", () => {
  it("la config porte bien le scope constant parent62", () => {
    expect(doc.costumSlug).toBe("parent62");
    expect(doc.scope).toEqual({ slugFrom: "constant", constant: "parent62" });
  });

  it("ADD : buildSpec résout costumSlug=parent62 (→ me.costum('parent62') avec presets article)", () => {
    const { spec } = registerCostumForm(doc);
    expect(spec.scope).toEqual({ slugFrom: "constant", constant: "parent62" });

    const cfg = specToConfig(spec);
    const mutAdd = cfg.buildSpec({ mode: "add" } as EntityModalCtx);
    expect(mutAdd.costumSlug).toBe("parent62");
    // type=article toujours estampillé par extraFields (config), indépendant du scope
    expect(mutAdd.inject?.extraFields).toMatchObject({ type: "article" });
  });

  it("EDIT : pas de scope costum (cible = entité)", () => {
    const { spec } = registerCostumForm(doc);
    const cfg = specToConfig(spec);
    const mutEdit = cfg.buildSpec({ mode: "edit", entity: null } as unknown as EntityModalCtx);
    expect(mutEdit.costumSlug).toBeUndefined();
  });
});
