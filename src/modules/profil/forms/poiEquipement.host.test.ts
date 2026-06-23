/**
 * Q2 — JsonFormHost CAPABLE de piloter poi-équipement en CONFIG-DRIVEN (READ seedEntity + WRITE costum-aware).
 *
 * Prouve que les helpers du host (buildPipelineDefaults / buildPipelinePayload), nourris UNIQUEMENT de la
 * config dérivée de poiEquipementDescriptor, reproduisent BYTE-POUR-BYTE le pipeline live de la modale :
 *  - READ : buildPipelineDefaults(config, poi) === buildEditDefaults(poi) (édition ET création) ;
 *  - WRITE create : buildPipelinePayload(config, v) === buildAddPoiPayload(v) ;
 *  - WRITE edit   : buildPipelinePayload(config, v, {emitEmpty}) === buildEditPoiPayload(v).
 * → le trou P3 (pas de READ entity-aware + perte des champs costum au WRITE) est comblé pour les descripteurs
 *   unifiés : tous les champs costum DÉCLARÉS transitent par le pipeline du descripteur (rien n'est perdu).
 */
import { describe, it, expect } from "vitest";
import type { Poi } from "@communecter/cocolight-api-client";
import { formDescriptorToConfig } from "@/modules/formEngine/config/formDescriptorToConfig";
import { poiEquipementDescriptor } from "./poiEquipement.descriptor";
import { isPipelineConfig, buildPipelineDefaults, buildPipelinePayload, runSubmit, type MeLike, type SubmitTarget } from "./jsonFormSubmit";
// side-effect : enregistre poi:* / geo:* + fournit le pipeline LIVE de référence.
import { buildEditDefaults, buildAddPoiPayload, buildEditPoiPayload, createEmptyDefaults } from "../components/add/poiEquipement";
import type { AddPoiFormData } from "../schemaForm";

const poiLike = (serverData: Record<string, unknown>) => ({ serverData }) as unknown as Poi;
const config = formDescriptorToConfig(poiEquipementDescriptor);
const base = () => createEmptyDefaults() as unknown as Record<string, unknown>;

const formValues = {
  ...createEmptyDefaults(),
  name: "Stade Host", equip_type_name: "Terrain", description: "d",
  equip_long: 25, equip_larg: 10, equip_eclair: true, inst_part_bool: true,
  tags: ["a"], aps_name: ["foot"], inst_part_type: ["x"], urls: ["https://x.fr"],
  addressCountry: "FR", addressLocality: "Lyon", postalCode: "69001",
  streetAddress: "1 rue X", localityId: "54c09653f6b95c141800849e",
  geo: { "@type": "GeoCoordinates", latitude: "45.76", longitude: "4.83" },
  geoPosition: { type: "Point", coordinates: [4.83, 45.76] },
} as unknown as AddPoiFormData as unknown as Record<string, unknown>;

const serverPoi = poiLike({
  name: "Stade X", type: "place", description: "desc",
  equip_surf: "250", equip_larg: 10, equip_long: "25", equip_eclair: "oui", inst_part_bool: true,
  tags: "a,b", aps_name: ["foot"], inst_part_type: "x,y", equip_type_name: "Terrain",
  inst_date_creation: "2020-05-01T12:00:00.000Z",
  address: { addressCountry: "FR", addressLocality: "Lyon", localityId: "abc", postalCode: "69001", streetAddress: "1 rue X", codeInsee: "69123" },
});

describe("JsonFormHost config-driven poi-équipement (Q2) — parité avec le pipeline live", () => {
  it("la config poi-équipement est reconnue UNIFIÉE (porte son pipeline)", () => {
    expect(isPipelineConfig(config)).toBe(true);
  });

  it("READ : buildPipelineDefaults(config, poi) === buildEditDefaults(poi) (édition)", () => {
    expect(buildPipelineDefaults(config, serverPoi, { baseDefaults: base })).toEqual(buildEditDefaults(serverPoi));
  });

  it("READ : buildPipelineDefaults(config, null) === buildEditDefaults(null) === createEmptyDefaults (création)", () => {
    expect(buildPipelineDefaults(config, null, { baseDefaults: base })).toEqual(buildEditDefaults(null));
    expect(buildPipelineDefaults(config, null, { baseDefaults: base })).toEqual(createEmptyDefaults());
  });

  it("WRITE create : buildPipelinePayload(config, v) === buildAddPoiPayload(v) (champs costum préservés)", () => {
    expect(buildPipelinePayload(config, formValues)).toEqual(buildAddPoiPayload(formValues as AddPoiFormData));
  });

  it("WRITE edit : buildPipelinePayload(config, v, {emitEmpty}) === buildEditPoiPayload(v)", () => {
    expect(buildPipelinePayload(config, formValues, { emitEmpty: true })).toEqual(buildEditPoiPayload(formValues as AddPoiFormData));
  });

  it("CÂBLAGE runSubmit : le payload qui atteint le SDK (scope costum) = pipeline du descripteur", async () => {
    let captured: Record<string, unknown> | undefined;
    let usedSlug: string | undefined;
    const target: SubmitTarget = {
      organization: async () => ({ save: async () => {} }),
      project: async () => ({ save: async () => {} }),
      event: async () => ({ save: async () => {} }),
      poi: async (p) => { captured = p; return { save: async () => {}, slug: "stade-host" }; },
    };
    const me: MeLike = { ...target, costum: async (slug) => { usedSlug = slug; return target; } };

    await runSubmit(config, formValues, { me });
    // entityType=poi + costum.slug=equipementsSportifs974 (dérivés de poiEquipementDescriptor)
    expect(usedSlug).toBe("equipementsSportifs974");
    // payload identique au pipeline du descripteur (pas de mapping générique → champs costum préservés)
    expect(captured).toEqual(buildPipelinePayload(config, formValues));
  });
});
