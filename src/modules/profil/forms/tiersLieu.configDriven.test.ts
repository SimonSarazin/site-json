/**
 * PILOTE config-driven (Phase 2) — entité tiers-lieu, le pipeline le plus complexe (4 serializeGroups :
 * openingDate/manageModel/typePlace/address + transforms tl:* + geo writeOnly + socialLinks clear).
 *
 * Prouve que le descripteur de PIPELINE tiers-lieu (`TIERSLIEU_DESCRIPTOR`) :
 *  1. se sérialise en `JsonFormConfig` VALIDE ;
 *  2. round-trip SANS PERTE (config → descripteur reproduit read/write/path/group/serializeGroups/writeOnly/clear) ;
 *  3. produit un `buildPayload` IDENTIQUE à l'original (donc fonctionnellement interchangeable).
 *
 * → débloque la migration tiers-lieu vers UNE config (render + pipeline) ; le moteur (Phase 1) sait
 * désormais tout exprimer. cf. doc/formulaire-config-driven.md (Phase 2).
 */
import { describe, it, expect } from "vitest";
import { buildPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import { JsonFormConfigSchema } from "@/modules/formEngine/config/schema";
import { formDescriptorToConfig } from "@/modules/formEngine/config/formDescriptorToConfig";
import { configToDescriptor } from "@/modules/formEngine/config/configToDescriptor";
// Import du module tiers-lieu = side-effect : enregistre les transforms tl:* + geo:write/geoPosition:write.
import { TIERSLIEU_DESCRIPTOR } from "../utils/tiersLieuxMapping";
import { getDefaultTiersLieuxValues } from "../utils/tiersLieux.schema";

// `tLoc` neutre : les libellés du descripteur pipeline sont déjà des string (clés/nom).
const tLoc = (l: unknown) => (typeof l === "string" ? l : ((l as { fr?: string })?.fr ?? ""));
// Normalise (drop des clés `undefined` ajoutées par configToDescriptor) pour comparer la structure.
const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("PILOTE config-driven tiers-lieu (Phase 2)", () => {
  const config = formDescriptorToConfig(TIERSLIEU_DESCRIPTOR);
  const d2 = configToDescriptor(config, { tLoc });

  it("1. le pipeline tiers-lieu se sérialise en JsonFormConfig VALIDE", () => {
    expect(() => JsonFormConfigSchema.parse(config)).not.toThrow();
    // les 4 groupes de sérialisation survivent à la config
    expect(config.serializeGroups).toEqual(TIERSLIEU_DESCRIPTOR.serializeGroups);
    expect(Object.keys(config.serializeGroups ?? {})).toEqual(["openingDate", "manageModel", "typePlace", "address"]);
  });

  it("2. round-trip config → descripteur SANS PERTE (read/write/group/serializeGroups/writeOnly)", () => {
    expect(norm(d2).serializeGroups).toEqual(TIERSLIEU_DESCRIPTOR.serializeGroups);
    // chaque champ : read/write/path/group/writeOnly/clear préservés
    expect(norm(d2).fields).toEqual(norm(TIERSLIEU_DESCRIPTOR).fields);
    // points sensibles explicites
    expect(d2.fields.socialLinks).toMatchObject({ read: "tl:socialRead", write: "tl:socialWrite", path: "socialNetwork", clear: "" });
    expect(d2.fields.surfaceBuilt).toMatchObject({ read: "tl:pickNumberString", write: "tl:numOrUndef", path: "buildingSurfaceArea" });
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

    const specOrig: FormSpec = { descriptor: TIERSLIEU_DESCRIPTOR };
    const specCfg: FormSpec = { descriptor: d2 };
    expect(buildPayload(specCfg, form)).toEqual(buildPayload(specOrig, form));
  });
});
