/**
 * PILOTE config-driven (Phase 2) — entité tiers-lieu, descripteur UNIFIÉ render+pipeline.
 *
 * Depuis la fusion, `tiersLieuxDescriptor` porte TOUT : widgets/layout (render) + read/write/path/group/
 * serializeGroups (pipeline, 4 groupes openingDate/manageModel/typePlace/address + geo writeOnly +
 * socialLinks clear + ancres renderOnly address/_logoFile). On prouve que ce descripteur UNIQUE :
 *  1. se sérialise en `JsonFormConfig` VALIDE ;
 *  2. round-trip SANS PERTE (config → descripteur reproduit render ET pipeline) ;
 *  3. produit un `buildPayload` IDENTIQUE à l'original (interchangeable).
 *
 * cf. doc/formulaire-config-driven.md (Phase 2). La byte-parité du pipeline réel est prouvée en plus
 * par tiersLieuxMapping.test (buildTiersLieuxPayload/mapEntityToTiersLieuxValues sur ce même descripteur).
 */
import { describe, it, expect } from "vitest";
import { buildPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import { JsonFormConfigSchema } from "@/modules/formEngine/config/schema";
import { formDescriptorToConfig } from "@/modules/formEngine/config/formDescriptorToConfig";
import { configToDescriptor } from "@/modules/formEngine/config/configToDescriptor";
import { tiersLieuxDescriptor } from "./costum/tiers-lieux/descriptor";
import { getDefaultTiersLieuxValues } from "./costum/tiers-lieux/fns";
// side-effect : enregistre les transforms tl:* + geo:write/geoPosition:write (référencés par clé dans le descripteur).
import "./costum/tiers-lieux/fns";

// identité : préserve le LocalizedString inline (résolu locale-aware au rendu par useT) → round-trip exact des labels objets.
const tLoc = (l: import("@/types/locale-schema").LocalizedString) => l;
const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("PILOTE config-driven tiers-lieu (Phase 2) — descripteur unifié", () => {
  const config = formDescriptorToConfig(tiersLieuxDescriptor);
  const d2 = configToDescriptor(config, { tLoc });

  it("1. le descripteur unifié se sérialise en JsonFormConfig VALIDE", () => {
    expect(() => JsonFormConfigSchema.parse(config)).not.toThrow();
    expect(config.serializeGroups).toEqual(tiersLieuxDescriptor.serializeGroups);
    expect(Object.keys(config.serializeGroups ?? {})).toEqual(["openingDate", "manageModel", "typePlace", "address"]);
  });

  it("2. round-trip config → descripteur SANS PERTE (render + pipeline)", () => {
    expect(norm(d2).serializeGroups).toEqual(tiersLieuxDescriptor.serializeGroups);
    expect(norm(d2).fields).toEqual(norm(tiersLieuxDescriptor).fields);
    // points sensibles
    expect(d2.fields.socialLinks).toMatchObject({ widget: "fieldArray", read: "social:read", write: "social:write", path: "socialNetwork", clear: "" });
    expect(d2.fields.address).toMatchObject({ widget: "location", renderOnly: true });
    expect(d2.fields.addressCountry).toMatchObject({ group: "address" });
    expect(d2.fields.geo).toMatchObject({ writeOnly: true, write: "geo:write" });
  });

  it("3. buildPayload via le descripteur ISSU DE LA CONFIG === via l'original (byte-parité)", () => {
    const form = {
      ...getDefaultTiersLieuxValues(),
      name: "TL Pilote", email: "x@y.fr", shortDescription: "sd", description: "",
      structureName: "Struct", surfaceBuilt: "120", surfaceOutdoor: "",
      phone: "", websiteUrl: "https://tl.org", videoUrl: "",
      socialLinks: [{ platform: "twitter", url: "https://t.co/x" }],
      openingMonth: "06", openingYear: "2024",
      managementType: "association",
      family: ["coworking", "foodlab"],
      addressCountry: "FR", addressLocality: "Lyon", postalCode: "69001",
      streetAddress: "1 rue", localityId: "54c09653f6b95c141800849e",
      geo: { "@type": "GeoCoordinates", latitude: "45.76", longitude: "4.83" },
      geoPosition: { type: "Point", coordinates: [4.83, 45.76] },
      hours: { ...getDefaultTiersLieuxValues().hours, monday: { enabled: true, start: "08:00", end: "18:00" } },
    } as Record<string, unknown>;

    const specOrig: FormSpec = { descriptor: tiersLieuxDescriptor };
    const specCfg: FormSpec = { descriptor: d2 };
    expect(buildPayload(specCfg, form)).toEqual(buildPayload(specOrig, form));
  });
});
