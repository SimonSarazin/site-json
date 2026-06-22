/**
 * Descripteur « Ajouter un événement » — pendant générique de AddEventModal. Mêmes noms de champs que
 * AddEventFormData → useAddEvent consommé tel quel. Layout tabs (info / dates / localisation).
 * FACTORY car la validation conditionnelle dépend du `parent` (organizer requis si pas de parent).
 * Les validations conditionnelles (organizer / dates / openingHours), faites « à la main » hors zod
 * dans l'ancien modal, passent ici dans `validate` (zodGen les exécute en superRefine — fiable).
 */
import { EVENT_TYPES } from "@communecter/cocolight-api-client";
import type { FieldDescriptor, FormDescriptor } from "@/modules/formEngine";
import { addressField, locationSection, nameField, shortDescriptionField, tagsField, urlField, PE } from "./addCommon";
import "./validators"; // side-effect : enregistre la clé "addEventValid" dans le validateRegistry

const TYPE_OPTIONS = EVENT_TYPES.map((t) => ({ value: t, label: `ProfileEdit.fields.eventType.options.${t}` }));

const fields: FieldDescriptor[] = [
  nameField({ rules: { minLength: 2 } }), // event : nom min 2 (eventProfileSchema)
  { name: "type", type: "string", widget: "select", required: true, enum: TYPE_OPTIONS,
    label: "ProfileEdit.fields.eventType.label", placeholder: "ProfileEdit.fields.eventType.placeholder", info: "ProfileEdit.fields.eventType.description" },
  // Sous-événement : finder sur les events de l'organisateur (filtre runtime via fieldProps.parent.filters).
  { name: "parent", type: "object", widget: "finder", label: PE("parentEvent.label"), placeholder: PE("parentEvent.placeholder"),
    widgetProps: { searchTypes: ["events"] } },
  shortDescriptionField,
  urlField,
  { name: "public", type: "boolean", widget: "checkbox", label: "AddEntity.modal.event.public", default: true },
  tagsField,
  // Composite : tout l'onglet dates (recurrency → startDate/endDate ou openingHours). Gère ses champs via le form.
  { name: "eventDates", type: "object", widget: "eventDates", label: "" },
  addressField,
];

export function buildAddEventDescriptor(hasParent: boolean): FormDescriptor {
  return {
    id: "add-event",
    collection: "events",
    layout: { kind: "tabs" },
    sections: [
      // `organizer` (rendu nul) listé pour le badge ; affiché en lecture seule via le slot organizerInfo.
      { id: "info", label: "AddEntity.tabs.info", groups: [
        { columns: 1, fields: ["$slot:organizerInfo", "name", "type", "parent", "shortDescription", "url", "public", "tags", "organizer"] },
      ] },
      // startDate/endDate/openingHours (rendus par le composite) listés pour le badge de l'onglet.
      { id: "dates", label: "AddEntity.tabs.dates", groups: [
        { columns: 1, fields: ["eventDates", "startDate", "endDate", "openingHours"] },
      ] },
      locationSection,
    ],
    // `_hasParent` (caché, default = présence d'un parent) modélise EN VALEUR ce qui était une closure :
    // la clé `addEventValid` lit `v._hasParent` (organizer requis SAUF si parent) + dates + adresse.
    // → descripteur 100% sérialisable, round-trip config exact (cf. validators.ts).
    fields: Object.fromEntries(
      [
        ...fields,
        { name: "_hasParent", type: "boolean", widget: "hidden", label: "", default: hasParent } as FieldDescriptor,
      ].map((f) => [f.name, f]),
    ),
    validate: "addEventValid",
  };
}
