import { describe, it, expect } from "vitest";
import type { FormDescriptor } from "@/modules/formEngine";
import { buildZodSchema, formDescriptorToConfig, configToDescriptor, JsonFormConfigSchema } from "@/modules/formEngine";
import { addPoiDescriptor } from "./addPoi.descriptor";
import { addProjectDescriptor } from "./addProject.descriptor";
import { addOrganizationDescriptor } from "./addOrganization.descriptor";
import { buildAddEventDescriptor } from "./addEvent.descriptor";
import { poiEquipementDescriptor } from "./costum/poiEquipement/descriptor";
import { tiersLieuDescriptor } from "./costum/tiersLieu/descriptor";
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
