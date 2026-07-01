/**
 * Descripteur « Ajouter un POI » (POI de base, hors équipement costum) — pendant générique de
 * AddPoiModal. Noms de champs alignés sur le payload POI standard (valeurs de form = `FormValues`).
 * Layout tabs (info / localisation), parité visuelle avec l'ancien modal.
 */
import type { FieldDescriptor, FormDescriptor } from "@/modules/formEngine";
import { addressField, locationSection, nameField, tagsField } from "./addCommon";
import "./validators"; // side-effect : enregistre la clé "validate:address" dans le validateRegistry
import "./costum/sharedCodecs"; // side-effect : address:read/write (serializeGroups.address) — le descripteur porte ses transforms d'écriture
import "./geoTransforms"; // side-effect : geo:write / geoPosition:write (champs geo writeOnly)

// Types de POI + libellés (FR codés en dur dans l'ancien modal — pas de clés i18n).
const POI_TYPES: Array<{ value: string; label: string }> = [
  { value: "place", label: "Lieu" }, { value: "link", label: "Lien" }, { value: "tool", label: "Outil" },
  { value: "machine", label: "Machine" }, { value: "software", label: "Logiciel" }, { value: "rh", label: "Ressource humaine" },
  { value: "video", label: "Vidéo" }, { value: "history", label: "Histoire" }, { value: "something2See", label: "À voir" },
  { value: "funPlace", label: "Lieu sympa" }, { value: "artPiece", label: "Oeuvre d'art" }, { value: "streetArts", label: "Art de rue" },
  { value: "openScene", label: "Scène ouverte" }, { value: "stand", label: "Stand" }, { value: "parking", label: "Parking" },
  { value: "other", label: "Autre" },
];

// Champ caché (write-only / membre de groupe adresse), non rendu.
const hidden = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor =>
  ({ name, type: "string", widget: "hidden", label: "", ...extra });
// Membres plats du groupe `address` recomposés en objet serveur par `address:write` (level1..4/codeInsee
// éventuels LUS par le codec depuis les valeurs, non déclarés). EditLocationTab (widget `location`) les pose.
const ADDRESS_MEMBERS = ["addressCountry", "addressLocality", "postalCode", "streetAddress", "localityId"];

const fields: FieldDescriptor[] = [
  nameField(),
  { name: "type", type: "string", widget: "select", required: true, label: "Type", placeholder: "Sélectionner un type", enum: POI_TYPES },
  { name: "description", type: "string", widget: "textarea", label: "ProfileEdit.fields.description.label", placeholder: "ProfileEdit.fields.description.placeholder", widgetProps: { rows: 4 } },
  tagsField,
  addressField, // widget `location` (RENDU) ; l'ÉCRITURE de l'adresse passe par les membres + serializeGroups ci-dessous
  // ── écriture adresse/geo (write-only, non rendus) : UN SEUL descripteur rendu+write, comme les costums ──
  ...ADDRESS_MEMBERS.map((n) => hidden(n, { group: "address" })),
  hidden("geo", { type: "object", writeOnly: true, write: "geo:write" }),
  hidden("geoPosition", { type: "object", writeOnly: true, write: "geoPosition:write" }),
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
  // Adresse plate → objet serveur (codecs COMMUNS sharedCodecs) : rend addPoiDescriptor capable d'ÉCRIRE l'adresse
  // → plus besoin d'un descripteur d'écriture séparé (addPoiWriteDescriptor supprimé).
  serializeGroups: { address: { serverKey: "address", read: "address:read", write: "address:write" } },
  validate: "validate:address", // clé de registre (= addressValidate) → sérialisable, round-trip config exact
};
