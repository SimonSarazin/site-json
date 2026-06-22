/**
 * Descripteur « Ajouter un projet » — pendant générique de AddProjectModal. Mêmes noms de champs que
 * AddProjectFormData → useAddProject consommé tel quel. Layout tabs (info / localisation).
 */
import type { FieldDescriptor, FormDescriptor } from "@/modules/formEngine";
import { addressField, locationSection, nameField, shortDescriptionField, tagsField, urlField } from "./addCommon";
import "./validators"; // side-effect : enregistre la clé "addressValid" dans le validateRegistry

const fields: FieldDescriptor[] = [
  nameField(),
  shortDescriptionField,
  urlField,
  { name: "public", type: "boolean", widget: "checkbox", label: "AddEntity.modal.project.public", default: true },
  tagsField,
  addressField,
];

export const addProjectDescriptor: FormDescriptor = {
  id: "add-project",
  collection: "projects",
  layout: { kind: "tabs" },
  sections: [
    { id: "info", label: "AddEntity.tabs.info", groups: [
      { columns: 1, fields: ["$slot:parentInfo", "name", "shortDescription", "url", "public", "tags"] },
    ] },
    locationSection,
  ],
  fields: Object.fromEntries(fields.map((f) => [f.name, f])),
  validate: "addressValid", // clé de registre (= addressValidate) → sérialisable, round-trip config exact
};
