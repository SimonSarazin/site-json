/**
 * Garde du RÉSOLVEUR sur la spec tiers-lieu : `specToConfig(tiersLieuxSpec)` doit reproduire EXACTEMENT
 * l'ex-`tiersLieuxSpec` (defaults/payload/EntityMutationSpec, add ET edit). Depuis le chantier stamps,
 * le payload = PIPELINE générique et le merge tags costum est DÉCLARATIF (`mutation.stamps`, append
 * `$costum`) — `buildTiersLieuxPayload` reste l'ORACLE : pipeline + applyPayloadStamps doivent lui être
 * byte-identiques (add : {costum} ; edit : {existingTags, addTags:[mainTag], complete}).
 */
import { describe, it, expect } from "vitest";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { specToConfig } from "../../resolveModalSpec";
import { applyPayloadStamps } from "../../stamps";
import {
  getDefaultTiersLieuxValues,
  buildTiersLieuxPayload as buildTiersLieuxPayloadRaw,
  type CostumConfig, type TiersLieuxFormData, type BuildPayloadOptions, type EntityLike,
} from "./fns";
import { seedEntity } from "@/modules/formEngine/engine/entityForm";
import type { FormValues } from "@/modules/formEngine";
import type { EntityModalCtx } from "../../entityModalSpec";
import { loadCostumForm } from "../__fixtures__/configCostum";

// Source = document JSON de config (config.prod), compilé via la voie unique registerCostumForm — plus de schema/spec/descriptor TS.
const { descriptor: tiersLieuxDescriptor, spec: tiersLieuxSpec } = loadCostumForm("tiers-lieux");

// DI : injecte le descripteur (= celui résolu via getDescriptor par les closures en prod) → parité.
const buildTiersLieuxPayload = (data: TiersLieuxFormData, options?: BuildPayloadOptions) =>
  buildTiersLieuxPayloadRaw(data, tiersLieuxDescriptor, options);
// READ = pipeline générique (seedEntity + socle), aucune logique costum — l'ex-wrapper prod a été retiré.
const mapEntityToTiersLieuxValues = (entity: EntityLike): TiersLieuxFormData =>
  seedEntity({ descriptor: tiersLieuxDescriptor, baseDefaults: () => getDefaultTiersLieuxValues() as unknown as FormValues }, entity) as unknown as TiersLieuxFormData;

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
    // Stamps résolus EAGER : mainTag (add+edit), compagnon (add seul — parité tl:payload edit) ;
    // le fixture costum n'a pas de compagnon → valeur undefined, stamp inerte à l'application.
    expect(mut.stamps).toEqual([
      { field: "tags", value: "TiersLieux", op: "append", on: "both" },
      { field: "tags", value: undefined, op: "append" },
    ]);
    // payload = PIPELINE seul (sans tags) ; pipeline + stamps ≡ l'ancien tl:payload (l'oracle).
    const form = { ...getDefaultTiersLieuxValues(), name: "Mon TL", shortDescription: "desc", managementType: "public", email: "a@b.fr" } as Record<string, unknown>;
    expect(mut.buildPayload(form)).toEqual(buildTiersLieuxPayload(form as never));
    expect(applyPayloadStamps(mut.buildPayload(form), mut.stamps, { mode: "add" }))
      .toEqual(buildTiersLieuxPayload(form as never, { costum }));
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
    // payload = pipeline complet (vides typés) SANS tags ; pipeline + stamps (mainTag seul en edit,
    // fusion des tags SERVEUR existants) ≡ l'ancien tl:payload edit — l'oracle.
    expect(mut.buildPayload(form)).toEqual(buildTiersLieuxPayload(form as never, { complete: true }));
    expect(applyPayloadStamps(mut.buildPayload(form), mut.stamps, { mode: "edit", targetServerData: { tags: ["déjà"] } }))
      .toEqual(buildTiersLieuxPayload(form as never, { existingTags: ["déjà"], addTags: ["TiersLieux"], complete: true }));
  });
});
