/**
 * Gardes du loader costum :
 *  A. COMPLÉTUDE — `assertCostumKeysRegistered` doit checker CHAQUE emplacement porteur de clé du descripteur
 *     ET de la spec. On cite une clé bidon partout et on vérifie qu'elles sont TOUTES listées (si un futur
 *     refactor retire un check, sa clé bidon disparaîtra du message → ce test casse).
 *  B. DÉCOUPLAGE — `sharedRegistrations` (barrel) fournit, À LUI SEUL (sans importer aucun costum métier),
 *     toutes les clés GÉNÉRIQUES qu'un costum 100 %-config peut référencer. Verrouille le fix anti-fragilité.
 */
import { describe, it, expect } from "vitest";
import { hasWidget, type FormDescriptor } from "@/modules/formEngine";
import { hasRegistered } from "@/modules/formEngine/engine/transforms";
import { hasSpecFn } from "../specRegistries";
import type { EntityModalSpec } from "../entityModalSpec";
import { assertCostumKeysRegistered } from "./assertKeysRegistered";
import "./sharedRegistrations"; // SEUL import de clés — PAS de costum métier (prouve le découplage)

describe("assertCostumKeysRegistered — complétude (A)", () => {
  it("liste TOUTES les clés non enregistrées (descripteur + spec)", () => {
    const descriptor = {
      id: "z", collection: "organizations", layout: { kind: "flat" }, sections: [],
      fields: {
        f: {
          name: "f", type: "string", widget: "text", label: "",
          read: "BOGUS_read", write: "BOGUS_write", enumFrom: "BOGUS_enumFrom",
          computedFrom: { deps: [], fn: "BOGUS_compute" },
        },
        w: { name: "w", type: "string", widget: "BOGUS_widget", label: "" }, // widget non enregistré → doit être listé
      },
      serializeGroups: { g: { serverKey: "g", read: "BOGUS_gread", write: "BOGUS_gwrite" } },
      validate: "BOGUS_validate",
    } as unknown as FormDescriptor;

    const spec = {
      id: "z", descriptor: { ref: "z" }, title: { add: "", edit: "" },
      descriptorVariant: "BOGUS_variant",
      defaults: { base: "BOGUS_defaults" },
      image: { field: "img", existingUrlFrom: "BOGUS_existingUrl" },
      scope: { derive: "BOGUS_scope" },
      slots: { s: "BOGUS_slot" },
      schemaFn: "BOGUS_schema",
      afterSubmit: "BOGUS_after",
      cleanValues: "BOGUS_clean",
      mutation: {
        entityType: "organization", payloadFn: "BOGUS_payload",
        invalidateFn: { fn: "BOGUS_invalidate" },
        successKey: "", errorKey: "", errorContext: "",
      },
    } as unknown as EntityModalSpec;

    const allBogus = [
      "BOGUS_read", "BOGUS_write", "BOGUS_enumFrom", "BOGUS_compute", "BOGUS_gread", "BOGUS_gwrite",
      "BOGUS_validate", "BOGUS_variant", "BOGUS_defaults", "BOGUS_existingUrl", "BOGUS_scope",
      "BOGUS_slot", "BOGUS_schema", "BOGUS_payload", "BOGUS_invalidate", "BOGUS_after", "BOGUS_clean",
      "BOGUS_widget",
    ];
    let msg = "";
    try { assertCostumKeysRegistered(descriptor, spec); } catch (e) { msg = (e as Error).message; }
    expect(msg, "la garde doit lever").not.toBe("");
    for (const k of allBogus) expect(msg, `clé non gardée : ${k}`).toContain(k);
  });

  it("ne lève PAS quand toutes les clés sont génériques (enregistrées par le barrel)", () => {
    const descriptor = {
      id: "ok", collection: "organizations", layout: { kind: "flat" }, sections: [],
      fields: {
        name: { name: "name", type: "string", widget: "text", label: "", read: "coerce:string", write: "coerce:string" },
        address: { name: "address", type: "object", widget: "location", label: "", renderOnly: true }, // widget DOMAINE → garanti par le barrel (parade #2)
      },
      serializeGroups: { address: { serverKey: "address", read: "address:read", write: "address:write" } },
      validate: "validate:addressComplete",
    } as unknown as FormDescriptor;
    const spec = {
      id: "ok", descriptor: { ref: "ok" }, title: { add: "", edit: "" },
      image: { field: "img", existingUrlFrom: "image:profilUrl" },
      cleanValues: { fn: "cleanValues:dropEmptyArrayItems" },
      mutation: { entityType: "organization", invalidateFn: { fn: "invalidate:standard" }, successKey: "", errorKey: "", errorContext: "" },
    } as unknown as EntityModalSpec;
    expect(() => assertCostumKeysRegistered(descriptor, spec)).not.toThrow();
  });
});

describe("sharedRegistrations — couverture des clés génériques (B, découplage)", () => {
  it("le barrel fournit À LUI SEUL toutes les clés génériques (sans aucun costum métier importé)", () => {
    for (const k of ["coerce:string", "coerce:number", "coerce:bool", "openingHours:read", "openingHours:write",
      "address:read", "address:write", "social:read", "social:write", "geo:write", "geoPosition:write"]) {
      expect(hasRegistered("transform", k), `transform ${k}`).toBe(true);
    }
    for (const k of ["validate:addressComplete", "validate:address"]) {
      expect(hasRegistered("validate", k), `validate ${k}`).toBe(true);
    }
    expect(hasSpecFn("existingUrlFn", "image:profilUrl")).toBe(true);
    expect(hasSpecFn("cleanValuesFn", "cleanValues:dropEmptyArrayItems")).toBe(true);
    expect(hasSpecFn("invalidateFn", "invalidate:standard")).toBe(true);
    expect(hasSpecFn("invalidateFn", "invalidate:blog")).toBe(true); // référencé par le form article (blog)
    // Widgets DOMAINE garantis par le barrel (parade #2) → la garde widget ne lève pas à tort en config/test.
    for (const w of ["location", "image", "tags", "finder", "openingHours", "editSocial", "editSchedule", "markdown"]) {
      expect(hasWidget(w), `widget ${w}`).toBe(true);
    }
  });
});
