/**
 * Descripteur « Ajouter un événement » — pendant générique de AddEventModal. Mêmes noms de champs que
 * AddEventFormData → useAddEvent consommé tel quel. Layout tabs (info / dates / localisation).
 * FACTORY car la validation conditionnelle dépend du `parent` (organizer requis si pas de parent).
 * Les validations conditionnelles (organizer / dates / openingHours), faites « à la main » hors zod
 * dans l'ancien modal, passent ici dans `validate` (zodGen les exécute en superRefine — fiable).
 */
import { EVENT_TYPES } from "@communecter/cocolight-api-client";
import type { FieldDescriptor, FormDescriptor, FormValues } from "@/modules/formEngine";
import { addressField, addressValidate, locationSection, nameField, shortDescriptionField, tagsField, urlField, PE } from "./addCommon";

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
    fields: Object.fromEntries(fields.map((f) => [f.name, f])),
    validate: (v: FormValues) => {
      const issues: Array<{ path: string; message: string }> = [];
      // organizer requis SAUF si parent fourni (le parent devient l'organisateur).
      if (!hasParent && (!v.organizer || Object.keys(v.organizer as Record<string, unknown>).length === 0))
        issues.push({ path: "organizer", message: "validation.organizer.required" });
      if (!v.recurrency) {
        // Ponctuel : dates requises + cohérentes.
        if (!v.startDate) issues.push({ path: "startDate", message: "validation.startDate.required" });
        if (!v.endDate) issues.push({ path: "endDate", message: "validation.endDate.required" });
        if (v.startDate && v.endDate && new Date(v.endDate as string) < new Date(v.startDate as string))
          issues.push({ path: "endDate", message: "validation.endDate.afterStart" });
      } else {
        // Récurrent : au moins une plage d'horaires.
        const oh = Array.isArray(v.openingHours) ? (v.openingHours as unknown[]).filter((h) => h !== "") : [];
        if (oh.length === 0) issues.push({ path: "openingHours", message: "validation.openingHours.required" });
      }
      issues.push(...addressValidate(v));
      return issues;
    },
  };
}
