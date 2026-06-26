import { describe, it, expect } from "vitest";
import type { FormDescriptor } from "@/modules/formEngine";
import { buildZodSchema, formDescriptorToConfig, configToDescriptor, JsonFormConfigSchema } from "@/modules/formEngine";
import { addPoiDescriptor } from "./addPoi.descriptor";
import { addProjectDescriptor } from "./addProject.descriptor";
import { addOrganizationDescriptor } from "./addOrganization.descriptor";
import { buildAddEventDescriptor } from "./addEvent.descriptor";
import { loadCostumForm } from "./costum/__fixtures__/configCostum";
import { tiersLieuxDescriptor } from "./costum/tiers-lieux/descriptor";
import { EDIT_DESCRIPTORS } from "./editProfile.descriptor";

// equipements : compilé depuis le JSON de config (config.prod) — plus de descriptor.ts TS. (tiers-lieux : phase 2.)
const equipementsSportifsDescriptor = loadCostumForm("equipements-sportifs").descriptor;

const ALL: Array<[string, FormDescriptor]> = [
  ["addPoi", addPoiDescriptor],
  ["addProject", addProjectDescriptor],
  ["addOrganization", addOrganizationDescriptor],
  ["addEvent", buildAddEventDescriptor(false)],
  ["equipements-sportifs", equipementsSportifsDescriptor],
  ["tiers-lieux", tiersLieuxDescriptor],
  ...Object.entries(EDIT_DESCRIPTORS).map(([k, d]): [string, FormDescriptor] => [`edit-${k}`, d]),
];

describe("smoke — tous les descripteurs du moteur", () => {
  it.each(ALL)("%s : buildZodSchema sans throw", (_n, d) => {
    expect(() => buildZodSchema(d)).not.toThrow();
  });

  it.each(ALL)("%s : formDescriptorToConfig → JsonFormConfig valide", (_n, d) => {
    const c = formDescriptorToConfig(d);
    expect(() => JsonFormConfigSchema.parse(c)).not.toThrow();
  });

  it.each(ALL)("%s : round-trip config → descriptor sans throw", (_n, d) => {
    const c = formDescriptorToConfig(d);
    expect(() => configToDescriptor(c, { tLoc: (l) => l.fr ?? "" })).not.toThrow();
  });
});
