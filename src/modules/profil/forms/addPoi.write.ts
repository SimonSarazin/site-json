/**
 * Descripteur d'ÉCRITURE du POI STANDARD — câblage adresse/geo GÉNÉRIQUE, autonome.
 *
 * Avant, `addPoi.payload` empruntait le descripteur du costum equipements (le « pont » : seul endroit portant
 * `serializeGroups.address` + geo writeOnly + name/description/tags). Ce câblage n'a RIEN d'equipements-spécifique
 * → on l'extrait ici pour que le poi standard ne dépende plus de `costum/equipements-sportifs/descriptor`.
 *
 * Byte-identique au pendant equipements pour une donnée de poi standard (mêmes champs : pas de `write` pour
 * text/hidden/tags → émis tels quels ; même groupe `address` (5 membres) + `address:write` ; même geo:write/
 * geoPosition:write). Couvert par useEntityMutation.test (poi standard) + spec.test (parité equipements).
 *
 * NB : descripteur d'ÉCRITURE seulement (utilisé par `buildPayload`) — le rendu du poi standard reste piloté
 * par `addPoi.descriptor` (widget `location`). read/default/label n'influencent pas le WRITE → omis ici.
 */
import type { FormDescriptor, FieldDescriptor } from "@/modules/formEngine";
import "./costum/sharedCodecs"; // address:read/write
import "./geoTransforms"; // geo:write / geoPosition:write

const hidden = (name: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor =>
  ({ name, type: "string", widget: "hidden", label: "", ...extra });

// Membres plats du groupe `address` (recomposés en objet serveur par `address:write` ; level1..4/codeInsee
// éventuels sont LUS par le codec depuis les valeurs mais non déclarés — parité exacte du descripteur equipements).
const ADDRESS_MEMBERS = ["addressCountry", "addressLocality", "postalCode", "streetAddress", "localityId"];

export const addPoiWriteDescriptor: FormDescriptor = {
  id: "add-poi-write",
  collection: "poi",
  layout: { kind: "flat" },
  sections: [],
  fields: {
    name: { name: "name", type: "string", widget: "text", label: "" },
    description: hidden("description"),
    tags: hidden("tags", { type: "array" }),
    ...Object.fromEntries(ADDRESS_MEMBERS.map((n) => [n, hidden(n, { group: "address" })])),
    geo: hidden("geo", { type: "object", writeOnly: true, write: "geo:write" }),
    geoPosition: hidden("geoPosition", { type: "object", writeOnly: true, write: "geoPosition:write" }),
  },
  serializeGroups: { address: { serverKey: "address", read: "address:read", write: "address:write" } },
};
