/**
 * PILOTE config-driven (généralisation Phase 2) — entité POI équipement, descripteur UNIFIÉ render+pipeline.
 *
 * Depuis la fusion, `equipementsSportifsDescriptor` porte TOUT : widgets/layout wizard (render) + read/write/
 * group/serializeGroups (pipeline : groupe `address` 14 clés + geo/geoPosition writeOnly + champs équipement
 * typés poi:to* + ancres renderOnly address/_imageFile + pipeline-only description/tags/localityId).
 * On prouve que ce descripteur UNIQUE :
 *  1. se sérialise en `JsonFormConfig` VALIDE ;
 *  2. round-trip SANS PERTE (config → descripteur reproduit render ET pipeline) ;
 *  3. produit un `seedEntity` (READ), un `buildPayload` (CREATE) ET un `buildEditPayload` (EDIT) IDENTIQUES
 *     à l'original — le descripteur issu de la config est interchangeable.
 *
 * cf. tiersLieu.configDriven.test.ts (même garde). La byte-parité du pipeline réel est prouvée en plus par
 * buildEditPoiPayload.test + poiEquipement.readMigration.test (sur ce même descripteur).
 */
import { describe, it, expect } from "vitest";
import type { Poi } from "@communecter/cocolight-api-client";
import { seedEntity, buildPayload, buildEditPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import { JsonFormConfigSchema } from "@/modules/formEngine/config/schema";
import { formDescriptorToConfig } from "@/modules/formEngine/config/formDescriptorToConfig";
import { configToDescriptor } from "@/modules/formEngine/config/configToDescriptor";
import { equipementsSportifsDescriptor } from "./costum/equipements-sportifs/descriptor";
// side-effect : enregistre les transforms poi:* (toString/…/addressRead/Write) + geo:write/geoPosition:write,
// référencés PAR CLÉ dans le descripteur. Fournit aussi createEmptyDefaults (socle baseDefaults).
import { createEmptyDefaults, type PoiEquipementScope } from "./costum/equipements-sportifs/fns";

// identité : préserve le LocalizedString inline (résolu locale-aware au rendu par useT) → round-trip exact des labels objets.
const tLoc = (l: import("@/types/locale-schema").LocalizedString) => l;
const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const poiLike = (serverData: Record<string, unknown>) => ({ serverData }) as unknown as Poi;
// Scope de test (ex-DEFAULT_POI_EQUIPEMENT_SCOPE, désormais en config) — socle des baseDefaults.
const SCOPE: PoiEquipementScope = { parentId: "p", sourceKey: "equipementsSportifs974", poiType: "recoveryCenter", addressCountry: "RE" };

describe("PILOTE config-driven POI équipement — descripteur unifié", () => {
  const config = formDescriptorToConfig(equipementsSportifsDescriptor);
  const d2 = configToDescriptor(config, { tLoc });

  const baseDefaults = () => createEmptyDefaults(SCOPE) as unknown as Record<string, unknown>;
  const specOrig: FormSpec = { descriptor: equipementsSportifsDescriptor, baseDefaults };
  const specCfg: FormSpec = { descriptor: d2, baseDefaults };

  it("1. le descripteur unifié se sérialise en JsonFormConfig VALIDE (serializeGroups address)", () => {
    expect(() => JsonFormConfigSchema.parse(config)).not.toThrow();
    expect(config.serializeGroups).toEqual(equipementsSportifsDescriptor.serializeGroups);
    expect(Object.keys(config.serializeGroups ?? {})).toEqual(["address"]);
  });

  it("2. round-trip config → descripteur SANS PERTE (render + pipeline)", () => {
    expect(norm(d2).serializeGroups).toEqual(equipementsSportifsDescriptor.serializeGroups);
    expect(norm(d2).fields).toEqual(norm(equipementsSportifsDescriptor).fields);
    // points sensibles
    expect(d2.fields.address).toMatchObject({ widget: "location", renderOnly: true });
    expect(d2.fields._imageFile).toMatchObject({ widget: "image", renderOnly: true });
    expect(d2.fields.addressCountry).toMatchObject({ group: "address" });
    expect(d2.fields.localityId).toMatchObject({ group: "address" });
    expect(d2.fields.geo).toMatchObject({ writeOnly: true, write: "geo:write" });
    expect(d2.fields.name).toMatchObject({ read: "coerce:string", default: "" });
    expect(d2.fields.equip_pmr_acc).toMatchObject({ read: "coerce:bool", default: false });
    expect(d2.fields.aps_name).toMatchObject({ read: "coerce:stringArray", default: [] });
  });

  it("3. seedEntity (READ) via le descripteur ISSU DE LA CONFIG === via l'original", () => {
    const server = {
      name: "Stade X", type: "place", description: "desc",
      equip_surf: "250", equip_larg: 10, equip_long: "25",
      equip_eclair: "oui", inst_part_bool: true, equip_pmr_acc: 1,
      tags: "a,b", aps_name: ["foot"], inst_part_type: "x,y",
      inst_date_creation: "2020-05-01T12:00:00.000Z", equip_type_name: "Terrain",
      address: { addressCountry: "FR", addressLocality: "Lyon", localityId: "abc", postalCode: "69001", streetAddress: "1 rue X", codeInsee: "69123" },
    };
    expect(seedEntity(specCfg, poiLike(server))).toEqual(seedEntity(specOrig, poiLike(server)));
    // création (entité absente) → socle createEmptyDefaults identique des deux côtés
    expect(seedEntity(specCfg, null)).toEqual(seedEntity(specOrig, null));
  });

  it("4. buildPayload (CREATE) + buildEditPayload (EDIT) via config === via l'original (byte-parité)", () => {
    const form = {
      ...createEmptyDefaults(SCOPE),
      name: "Stade Pilote", equip_type_name: "Terrain", description: "d",
      equip_long: 25, equip_larg: 10, equip_eclair: false, inst_part_bool: true,
      tags: ["a"], aps_name: ["foot"], inst_part_type: ["x"], urls: ["https://x.fr"],
      addressCountry: "FR", addressLocality: "Lyon", postalCode: "69001",
      streetAddress: "1 rue X", localityId: "54c09653f6b95c141800849e",
      geo: { "@type": "GeoCoordinates", latitude: "45.76", longitude: "4.83" },
      geoPosition: { type: "Point", coordinates: [4.83, 45.76] },
    } as Record<string, unknown>;

    expect(buildPayload(specCfg, form)).toEqual(buildPayload(specOrig, form));
    expect(buildEditPayload(specCfg, form)).toEqual(buildEditPayload(specOrig, form));
  });
});
