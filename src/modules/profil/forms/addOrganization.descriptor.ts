/**
 * Descripteur « Ajouter une organisation » — pendant générique de AddOrganizationModal. Mêmes noms de
 * champs que AddOrganizationFormData → useAddOrganization consommé tel quel. Layout tabs (info / loc).
 * NB : `role` (admin/member) est le rôle d'appartenance du créateur, pas un champ du document — il
 * transite tel quel dans le payload SDK (le moteur renvoie toutes les valeurs plates).
 */
import { ORGANIZATION_TYPES } from "@communecter/cocolight-api-client";
import type { FieldDescriptor, FormDescriptor } from "@/modules/formEngine";
import { addressField, locationSection, nameField, shortDescriptionField, tagsField, urlField, PE } from "./addCommon";
import "./validators"; // side-effect : enregistre la clé "validate:address" dans le validateRegistry

const TYPE_OPTIONS = ORGANIZATION_TYPES.map((t) => ({ value: t, label: PE(`type.options.${t}`) }));
const ROLE_OPTIONS = [
  { value: "admin", label: "InviteMemberDialog.badges.admin" },
  { value: "member", label: "InviteMemberDialog.badges.member" },
];

const fields: FieldDescriptor[] = [
  nameField({ rules: { minLength: 3 } }), // AddOrganization : nom min 3 (addOrganizationSchema)
  { name: "type", type: "string", widget: "select", required: true, enum: TYPE_OPTIONS,
    label: PE("type.label"), placeholder: PE("type.placeholder"), info: PE("type.description") },
  { name: "role", type: "string", widget: "select", required: true, enum: ROLE_OPTIONS,
    label: "InviteMemberDialog.role", placeholder: "InviteMemberDialog.selectRole" },
  shortDescriptionField,
  { name: "email", type: "string", widget: "text", widgetProps: { inputType: "email" },
    rules: { regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    label: PE("email.label"), placeholder: PE("email.placeholder") },
  urlField,
  tagsField,
  addressField,
];

export const addOrganizationDescriptor: FormDescriptor = {
  id: "add-organization",
  collection: "organizations",
  layout: { kind: "tabs" },
  sections: [
    { id: "info", label: "AddEntity.tabs.info", groups: [
      { columns: 1, fields: ["$slot:parentInfo", "name", "type", "role", "shortDescription", "email", "url", "tags"] },
    ] },
    locationSection,
  ],
  fields: Object.fromEntries(fields.map((f) => [f.name, f])),
  validate: "validate:address", // clé de registre (= addressValidate) → sérialisable, round-trip config exact
};
