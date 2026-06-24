/**
 * Garde du RÉSOLVEUR sur la spec poi-équipement : `specToConfig(equipementsSportifsSpec)` doit reproduire EXACTEMENT
 * le comportement de l'ancien `equipementsSportifsSpec` (defaults/payload/EntityMutationSpec, add ET edit).
 * C'est la seule couverture auto de `specToConfig` (le reste de la byte-parité = poiEquipement.configDriven).
 */
import { describe, it, expect } from "vitest";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { specToConfig } from "../../resolveModalSpec";
import { equipementsSportifsSpec } from "./spec";
import { createEmptyDefaults, buildAddPoiPayload, type PoiEquipementScope } from "./fns";
import type { EntityModalCtx } from "../../entityModalSpec";

const carrier = { id: "65a04155ed047177b9239968", serverData: { slug: "equipementsSportifs974", lists: {} } } as unknown as EntityTypes;
const me = { id: "meId" } as unknown as EntityTypes;

describe("résolveur — spec poi-équipement (parité avec l'ex-config)", () => {
  const config = specToConfig(equipementsSportifsSpec);
  const scope = config.resolveScope!(carrier) as PoiEquipementScope;

  it("scope dérivé du carrier (poi:scope)", () => {
    expect(scope).toMatchObject({ sourceKey: "equipementsSportifs974", parentId: "65a04155ed047177b9239968" });
  });

  it("descripteur résolu = poi-equipement", () => {
    const ctx: EntityModalCtx = { mode: "add", parent: null, scope, me, carrier, entity: null };
    const d = typeof config.descriptor === "function" ? config.descriptor(ctx) : config.descriptor;
    expect(d.id).toBe("equipements-sportifs");
  });

  it("ADD : EntityMutationSpec (costumSlug/keys/inject) + defaults + payload pipeline === buildAddPoiPayload", () => {
    const ctx: EntityModalCtx = { mode: "add", parent: null, scope, me, carrier, entity: null };
    const mut = config.buildSpec(ctx);
    expect(mut).toMatchObject({
      mode: "add", entityType: "poi", costumSlug: "equipementsSportifs974",
      imageField: "_imageFile", navigateOnSuccess: false,
      successKey: "toast.add.poiSuccess", errorKey: "toast.add.poiError", errorContext: "EntityFormModal · ADD_POI",
    });
    expect(mut.inject).toMatchObject({ parent: null });
    // defaults add = createEmptyDefaults(scope)
    expect(config.buildDefaults(ctx)).toEqual(createEmptyDefaults(scope));
    // payload create via pipeline === buildAddPoiPayload (byte-identité round-trip)
    const form = { ...createEmptyDefaults(scope), name: "Stade", equip_type_name: "Terrain", equip_long: 25 } as unknown as Record<string, unknown>;
    expect(mut.buildPayload(form)).toEqual(buildAddPoiPayload(form as never));
  });

  it("EDIT : target=entité, pas de costumSlug, keys d'update", () => {
    const entity = { slug: "equip-x", serverData: { name: "Equip X", address: {} } } as unknown as EntityTypes;
    const ctx: EntityModalCtx = { mode: "edit", parent: null, scope, me, carrier, entity };
    const mut = config.buildSpec(ctx);
    expect(mut).toMatchObject({
      mode: "edit", entityType: "poi",
      successKey: "toast.profile.updateSuccess", errorKey: "toast.profile.updateError", errorContext: "EntityFormModal · UPDATE_POI",
    });
    expect(mut.target).toBe(entity);
    expect(mut.costumSlug).toBeUndefined();
  });
});
