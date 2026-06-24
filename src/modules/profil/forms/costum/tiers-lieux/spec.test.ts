/**
 * Garde du RÉSOLVEUR sur la spec tiers-lieu : `specToConfig(tiersLieuxSpec)` doit reproduire EXACTEMENT
 * l'ex-`tiersLieuxSpec` (defaults/payload/EntityMutationSpec, add ET edit). Le payload tiers-lieu a un
 * merge de tags costum (payloadFn `tl:payload`) → on vérifie l'égalité avec buildTiersLieuxPayload.
 */
import { describe, it, expect } from "vitest";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { specToConfig } from "../../resolveModalSpec";
import { tiersLieuxSpec } from "./spec";
import { getDefaultTiersLieuxValues, buildTiersLieuxPayload, mapEntityToTiersLieuxValues, type CostumConfig } from "./fns";
import type { EntityModalCtx } from "../../entityModalSpec";

const carrier = { id: "carrierId", serverData: { slug: "franceTiersLieux" } } as unknown as EntityTypes;
const me = { id: "meId" } as unknown as EntityTypes;
const costum: CostumConfig = { mainTag: "TiersLieux" };

describe("résolveur — spec tiers-lieu (parité avec l'ex-config)", () => {
  const config = specToConfig(tiersLieuxSpec);
  const scope = config.resolveScope!(carrier) as { slug: string };

  it("scope = slug du porteur", () => {
    expect(scope).toEqual({ slug: "franceTiersLieux" });
  });

  it("descripteur résolu = tiers-lieu", () => {
    const ctx: EntityModalCtx = { mode: "add", parent: null, scope, me, carrier, costum };
    const d = typeof config.descriptor === "function" ? config.descriptor(ctx) : config.descriptor;
    expect(d.id).toBe("tiers-lieux");
  });

  it("ADD : mutationSpec (costumSlug/keys) + defaults + payload === buildTiersLieuxPayload(costum)", () => {
    const ctx: EntityModalCtx = { mode: "add", parent: null, scope, me, carrier, costum };
    const mut = config.buildSpec(ctx);
    expect(mut).toMatchObject({
      mode: "add", entityType: "organizations", costumSlug: "franceTiersLieux", imageField: "_logoFile",
      successKey: "AddTiersLieux.toast.success", errorKey: "AddTiersLieux.toast.error", errorContext: "EntityFormModal · ADD_TIERSLIEU",
    });
    expect(config.buildDefaults(ctx)).toEqual(getDefaultTiersLieuxValues());
    // STAMP costum : type "NGO" + preferences posés au CREATE via inject.extraFields (plus dans submit.extraData).
    expect(mut.inject?.extraFields).toEqual({ type: "NGO", preferences: { isOpenData: true, isOpenEdition: true } });
    // payload pipeline+tags (le stamp est appliqué APRÈS par runEntityMutation, pas dans buildPayload).
    const form = { ...getDefaultTiersLieuxValues(), name: "Mon TL", shortDescription: "desc", managementType: "public", email: "a@b.fr" } as Record<string, unknown>;
    expect(mut.buildPayload(form)).toEqual(buildTiersLieuxPayload(form as never, { costum }));
  });

  it("EDIT : target=entité, pas de costumSlug, defaults===map, payload complet+merge tags", () => {
    const entity = { slug: "tl-x", serverData: { name: "TL X", tags: ["déjà"] } } as unknown as EntityTypes;
    const ctx: EntityModalCtx = { mode: "edit", parent: null, scope, me, carrier, costum, entity };
    const mut = config.buildSpec(ctx);
    expect(mut).toMatchObject({
      mode: "edit", entityType: "organizations",
      successKey: "EditTiersLieux.toast.success", errorContext: "EntityFormModal · EDIT_TIERSLIEU",
    });
    expect(mut.target).toBe(entity);
    expect(mut.costumSlug).toBeUndefined();
    expect(config.buildDefaults(ctx)).toEqual(mapEntityToTiersLieuxValues(entity as never));
    const form = { ...getDefaultTiersLieuxValues(), name: "TL X" } as Record<string, unknown>;
    expect(mut.buildPayload(form)).toEqual(buildTiersLieuxPayload(form as never, { existingTags: ["déjà"], addTags: ["TiersLieux"], complete: true }));
  });
});
