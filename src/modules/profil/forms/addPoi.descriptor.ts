/**
 * Descripteur « Ajouter un POI » (POI de base, hors équipement costum) — pendant générique de
 * AddPoiModal. Mêmes noms de champs que AddPoiFormData → useAddPoi consommé tel quel.
 * Layout tabs (info / localisation), parité visuelle avec l'ancien modal.
 */
import type { FieldDescriptor, FormDescriptor } from "@/modules/formEngine";
import { addressField, locationSection, nameField, tagsField } from "./addCommon";
import "./validators"; // side-effect : enregistre la clé "addressValid" dans le validateRegistry

// Types de POI + libellés (FR codés en dur dans l'ancien modal — pas de clés i18n).
const POI_TYPES: Array<{ value: string; label: string }> = [
  { value: "place", label: "Lieu" }, { value: "link", label: "Lien" }, { value: "tool", label: "Outil" },
  { value: "machine", label: "Machine" }, { value: "software", label: "Logiciel" }, { value: "rh", label: "Ressource humaine" },
  { value: "video", label: "Vidéo" }, { value: "history", label: "Histoire" }, { value: "something2See", label: "À voir" },
  { value: "funPlace", label: "Lieu sympa" }, { value: "artPiece", label: "Oeuvre d'art" }, { value: "streetArts", label: "Art de rue" },
  { value: "openScene", label: "Scène ouverte" }, { value: "stand", label: "Stand" }, { value: "parking", label: "Parking" },
  { value: "other", label: "Autre" },
];

const fields: FieldDescriptor[] = [
  nameField(),
  { name: "type", type: "string", widget: "select", required: true, label: "Type", placeholder: "Sélectionner un type", enum: POI_TYPES },
  { name: "description", type: "string", widget: "textarea", label: "ProfileEdit.fields.description.label", placeholder: "ProfileEdit.fields.description.placeholder", widgetProps: { rows: 4 } },
  tagsField,
  addressField,
];

export const addPoiDescriptor: FormDescriptor = {
  id: "add-poi",
  collection: "poi",
  layout: { kind: "tabs" },
  sections: [
    { id: "info", label: "AddEntity.tabs.info", groups: [
      { columns: 1, fields: ["$slot:parentInfo", "name", "type", "description", "tags"] },
    ] },
    locationSection,
  ],
  fields: Object.fromEntries(fields.map((f) => [f.name, f])),
  validate: "addressValid", // clé de registre (= addressValidate) → sérialisable, round-trip config exact
};
