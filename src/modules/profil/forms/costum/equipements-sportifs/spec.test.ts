/**
 * Garde du RÉSOLVEUR sur la spec poi-équipement : `specToConfig(equipementsSportifsSpec)` doit reproduire EXACTEMENT
 * le comportement de l'ancien `equipementsSportifsSpec` (defaults/payload/EntityMutationSpec, add ET edit).
 * C'est la seule couverture auto de `specToConfig` (le reste de la byte-parité = poiEquipement.configDriven).
 */
import { describe, it, expect } from "vitest";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { specToConfig } from "../../resolveModalSpec";
import { createEmptyDefaults, type PoiEquipementScope } from "./fns";
import { buildPayload } from "@/modules/formEngine/engine/entityForm";
import type { EntityModalCtx } from "../../entityModalSpec";
import { loadCostumForm } from "../__fixtures__/configCostum";

// Source = document JSON de config (config.prod), compilé via la voie unique registerCostumForm — plus de schema/spec/descriptor TS.
const { descriptor: equipementsSportifsDescriptor, spec: equipementsSportifsSpec } = loadCostumForm("equipements-sportifs");

// Référence de parité : pipeline générique sur le descripteur equipements + STAMP `type` (form.type) —
// reproduit l'ex-buildAddPoiPayload (le descripteur equipements n'a pas de champ `type`, c'est un stamp).
const refPayload = (form: Record<string, unknown>) =>
  ({ ...buildPayload({ descriptor: equipementsSportifsDescriptor }, form), ...(form.type ? { type: form.type } : {}) });

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
    // STAMP costum : type "recoveryCenter" posé au CREATE via inject.extraFields (plus dans le descripteur).
    expect(mut.inject?.extraFields).toEqual({ type: "recoveryCenter" });
    // defaults add = createEmptyDefaults(scope, equipementsSportifsDescriptor)
    expect(config.buildDefaults(ctx)).toEqual(createEmptyDefaults(scope, equipementsSportifsDescriptor));
    // payload create costum = pipeline (sans `type`) + STAMP (inject.extraFields) → doit égaler l'ex-payload
    // buildAddPoiPayload (qui portait `type` via le champ descripteur). Byte-parité de la création préservée.
    const form = { ...createEmptyDefaults(scope, equipementsSportifsDescriptor), name: "Stade", equip_type_name: "Terrain", equip_long: 25 } as unknown as Record<string, unknown>;
    // Parité création equipements : la modale (pipeline + stamp inject) == pipeline générique + stamp type.
    expect({ ...mut.buildPayload(form), ...(mut.inject?.extraFields ?? {}) }).toEqual(refPayload(form as Record<string, unknown>));
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
    // STAMP non-effaçant : le payload d'édition n'émet PAS `type` (ni l'inject, create-only) → clé ABSENTE
    // → Object.assign(entity.data, payload) ne touche pas le `type` existant (préservé, jamais $unset).
    const editForm = { ...createEmptyDefaults(scope, equipementsSportifsDescriptor), name: "Equip X" } as unknown as Record<string, unknown>;
    expect(mut.buildPayload(editForm)).not.toHaveProperty("type");
    expect(mut.inject).toBeUndefined(); // édition : aucun inject (donc pas d'extraFields type)
  });
});
