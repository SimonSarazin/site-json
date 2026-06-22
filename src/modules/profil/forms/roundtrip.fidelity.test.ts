import { describe, it, expect } from "vitest";
import type { FormDescriptor } from "@/modules/formEngine";
import { formDescriptorToConfig, configToDescriptor, JsonFormConfigSchema, descriptorToTsSource } from "@/modules/formEngine";
import { addPoiDescriptor } from "./addPoi.descriptor";
import { addProjectDescriptor } from "./addProject.descriptor";
import { addOrganizationDescriptor } from "./addOrganization.descriptor";
import { buildAddEventDescriptor } from "./addEvent.descriptor";
import { poiEquipementDescriptor } from "./poiEquipement.descriptor";
import { tiersLieuDescriptor } from "./tiersLieu.descriptor";
import { EDIT_DESCRIPTORS } from "./editProfile.descriptor";

const ALL: Array<[string, FormDescriptor]> = [
  ["addPoi", addPoiDescriptor],
  ["addProject", addProjectDescriptor],
  ["addOrganization", addOrganizationDescriptor],
  ["addEvent", buildAddEventDescriptor(false)],
  ["poiEquipement", poiEquipementDescriptor],
  ["tiersLieu", tiersLieuDescriptor],
  ...Object.entries(EDIT_DESCRIPTORS).map(([k, d]): [string, FormDescriptor] => [`edit-${k}`, d]),
];

// Libellés du descripteur = strings (clés i18n / texte) → resolveLabel les passe tels quels ;
// ce tLoc n'est appelé que pour un éventuel LocalizedString (jamais ici) → round-trip EXACT des labels.
const tLoc = (l: { fr?: string }) => l?.fr ?? "";

/** descripteur → config → parse (schéma) → descripteur. Le `parse` garantit qu'AUCUN champ n'est strippé. */
function roundTrip(d: FormDescriptor): FormDescriptor {
  const config = JsonFormConfigSchema.parse(formDescriptorToConfig(d));
  return configToDescriptor(config, { tLoc });
}

/** Retire `validate` (une FONCTION inline n'est pas sérialisable → comparée à part). */
function withoutValidate(d: FormDescriptor): Omit<FormDescriptor, "validate"> {
  const { validate: _v, ...rest } = d;
  return rest;
}

describe("fidélité round-trip : la config fait EXACTEMENT ce que le descripteur TS", () => {
  it.each(ALL)("%s : descripteur → config → descripteur IDENTIQUE (hors validate fn)", (_n, d) => {
    const d2 = roundTrip(d);
    // toEqual ignore les `undefined` (configToDescriptor pose des props absentes à undefined) → comparaison structurelle.
    expect(withoutValidate(d2)).toEqual(withoutValidate(d));
  });

  it.each(ALL)("%s : validate = CLÉ string (aucune fonction inline) → round-trip EXACT", (_n, d) => {
    // Garde : tous les validate ont été convertis en clés de registre (sérialisables).
    expect(typeof d.validate).not.toBe("function");
    const d2 = roundTrip(d);
    expect(d2.validate).toBe(d.validate); // clé string OU undefined → round-trip exact dans les 2 cas
  });

  it("variant visuel (section.icon + layout stepper/progress/header) round-trip EXACT", () => {
    const rich: FormDescriptor = {
      id: "rich-variant",
      collection: "organizations",
      layout: { kind: "wizard", validatePerStep: true, stepper: "tabs", progress: "bar", header: "gradient" },
      sections: [
        { id: "a", label: "A", icon: "building-2", fields: ["name"] },
        { id: "b", label: "B", icon: "map-pin", fields: ["email"] },
      ],
      fields: {
        name: { name: "name", type: "string", widget: "text", label: "Nom", required: true },
        email: { name: "email", type: "string", widget: "email", label: "Email" },
      },
    };
    expect(roundTrip(rich)).toEqual(rich); // icône + options de présentation préservées via config
  });

  it.each(ALL)("%s : émetteur descriptorToTsSource produit une source valide non vide", (_n, d) => {
    const ts = descriptorToTsSource(d);
    expect(ts).toContain("export const");
    expect(ts).toContain(": FormDescriptor =");
    // le corps émis re-parse en objet (le littéral = JSON valide)
    const body = ts.slice(ts.indexOf("=") + 1).replace(/;\s*$/, "").trim();
    expect(() => JSON.parse(body)).not.toThrow();
  });
});
