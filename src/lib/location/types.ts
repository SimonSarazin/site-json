/**
 * Modèle d'adresse géolocalisée — parité avec le dynForm Communecter
 * (`createLocalityObj` / `addressInDynform.php`).
 *
 * Une adresse est un objet schema.org à trois sous-objets :
 *  - `address`     : PostalAddress (pays, ville, CP, rue, INSEE, localityId, niveaux administratifs)
 *  - `geo`         : GeoCoordinates (latitude/longitude en STRING)
 *  - `geoPosition` : GeoJSON Point (coordinates [lng, lat] en NUMBER) — indexable pour `$near`
 *
 * Points de vigilance :
 *  - `localityId` est le SEUL champ requis (gate backend `addressValid`).
 *  - `codeInsee` est optionnel (le legacy écrit parfois le littéral "undefined" → à omettre).
 *  - Les niveaux `level1..5` sont ÉPARS : on n'émet que ceux réellement présents.
 */

export interface GeoCoordinates {
  "@type"?: "GeoCoordinates" | string;
  latitude: string;
  longitude: string;
}

export interface GeoPosition {
  type: "Point" | string;
  /** Ordre GeoJSON : [longitude, latitude]. */
  coordinates: [number, number];
}

export interface PostalAddress {
  "@type"?: "PostalAddress" | string;
  addressCountry?: string;
  addressLocality?: string;
  postalCode?: string;
  streetAddress?: string;
  codeInsee?: string;
  /** Id de la ville (collection `cities`) — REQUIS pour la validation backend. */
  localityId?: string;
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
  level5?: string;
  level5Name?: string;
}

/** Une adresse complète telle que stockée (miroir d'une entrée `createLocalityObj`). */
export interface FormLocalityEntry {
  address: PostalAddress;
  geo: GeoCoordinates;
  geoPosition: GeoPosition;
  /** `true` sur l'adresse principale (une seule dans un tableau). */
  center?: boolean;
}

/**
 * Valeur stockée d'un champ adresse de coform sous `answers[formId][key]`.
 * Miroir exact de ce que produisait `addressInDynform.php` : le tableau complet
 * + l'adresse principale recopiée à plat (`address`/`geo`/`geoPosition`) pour la
 * lecture/affichage/carte, + les autres adresses dans `addresses`.
 */
export interface StoredLocality {
  formLocality: FormLocalityEntry[];
  address?: PostalAddress;
  geo?: GeoCoordinates;
  geoPosition?: GeoPosition;
  addresses?: FormLocalityEntry[];
}

/** Ville renvoyée par l'autocomplétion (`cityAutocompleteByCountry`). */
export interface City {
  /** `_id` réel si la ville est en base ; clé numérique (bidon) si `save:true` (Nominatim). */
  id: string;
  name: string;
  insee?: string;
  country?: string;
  countryCode?: string;
  postalCodes: Array<{
    postalCode: string;
    name?: string;
    geo?: { "@type"?: string; latitude: string | number; longitude: string | number };
    geoPosition?: { type?: string; coordinates: [number | string, number | string] };
  }>;
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
  level5?: string;
  level5Name?: string;
  /** Coordonnées de niveau VILLE — présentes même sans code postal. */
  geo?: { "@type"?: string; latitude: string | number; longitude: string | number };
  geoPosition?: { type?: string; coordinates: [number | string, number | string] };
  /** `true` (ou "true") si la ville n'est PAS en base : nécessite un appel `city/save` pour la persister. */
  save?: boolean | string;
  /** Champs Nominatim conservés pour un éventuel `city/save`. */
  osmID?: string | number;
  alternateName?: string;
}

/** Rue renvoyée par l'autocomplétion BAN (`data.geopf.fr`). */
export interface Street {
  streetAddress: string;
  /** [lon, lat] (ordre BAN). */
  geo?: [number, number];
  id?: string;
  /** Granularité BAN : `housenumber` | `street` | `locality` | `municipality`. */
  type?: string;
}
