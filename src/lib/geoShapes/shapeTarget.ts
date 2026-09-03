import type { GeoJsonProperties } from "geojson";

/**
 * Cible de navigation d'un contour cliquable : `path?filterId=<valeur>`.
 *
 * Contrat repris À L'IDENTIQUE de `regionsTarget` / `thematicsTarget` (`modules/search/schema.ts`) :
 * on n'écrit PAS dans l'état de filtres, on pose un query param et on laisse la page cible
 * l'hydrater (`computeFiltersFromUrl`). C'est ce qui rend le lien partageable et le bouton
 * « précédent » cohérent.
 *
 * ⚠️ La page cible doit porter un groupe de filtres dont l'`id` vaut `filterId` ET dont une option
 * porte la valeur émise : `computeFiltersFromUrl` résout par `(o.name || o.id) === v || o.id === v`
 * et **jette silencieusement** ce qui ne matche pas. D'où `valueFrom`, qui laisse choisir la
 * propriété du contour à confronter aux options réelles du groupe.
 */

/**
 * Propriété de la feature utilisée comme valeur de filtre. Ce sont les seules que
 * `toFeatureCollection` expose (`geoShapeQuery.ts`) : la donnée legacy n'en porte pas d'autres de
 * façon fiable.
 *
 * `_id` est l'identifiant MongoDB du contour (un ObjectId, `"6a5f1eeddfc32aeb4f68bccb"`), sous le nom
 * même que lui donne la base. C'est le seul choix STABLE : un contour peut être renommé, son
 * identifiant non. À utiliser en face d'un filtre dont les options viennent du même référentiel
 * (`optionsFrom.shapes`), qui les identifie par ce même `_id`.
 *
 * Nommé `_id` et non `docId` : dans ce dépôt, `docId` désigne déjà le FICHIER téléversé
 * (`{docId, docPath}` du coform, de la galerie, de `FilesList`). Un mot, un sens.
 */
export type ShapeValueFrom = "name" | "insee" | "_id" | "countryCode" | "level";

export interface ShapeTarget {
  path: string;
  filterId: string;
  valueFrom?: ShapeValueFrom;
  /** Restreint la cliquabilité à ces `id` de couche. Absent = toutes. */
  layers?: string[];
}

/**
 * Valeur de filtre portée par un contour, ou `null` si la propriété manque.
 *
 * `level` est stocké en TABLEAU DE CHAÎNES en base (`["6"]`), parfois en chaîne nue selon l'import :
 * on prend le premier élément plutôt que de coercer un tableau en `"6,7"`.
 */
export function shapeValue(
  properties: GeoJsonProperties,
  valueFrom: ShapeValueFrom = "name",
): string | null {
  const raw = properties?.[valueFrom];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/**
 * URL de destination d'un contour, ou `null` s'il n'a pas de valeur exploitable — le contour est
 * alors rendu comme du DÉCOR plutôt qu'en lien mort.
 *
 * ⚠️ La VALEUR est encodée DEUX FOIS, et c'est volontaire. La page cible relit le paramètre en
 * trois temps (`computeFiltersFromUrl`) : `new URLSearchParams(…)` — qui décode déjà une couche —
 * puis `.split(",")`, puis `decodeURIComponent` de chaque segment. Un simple
 * `encodeURIComponent` ferait donc réapparaître la virgule AVANT le découpage :
 * `"Saint-Denis, Nord"` reviendrait en DEUX valeurs (`"Saint-Denis"` et `"Nord"`), dont aucune ne
 * matcherait une option — le lien « marche » et ne filtre rien. La seconde couche traverse
 * `URLSearchParams` intacte et c'est le `decodeURIComponent` final qui la retire.
 * Un nom sans caractère spécial (le cas courant) est inchangé par les deux passes : l'URL reste
 * lisible. La CLÉ, elle, n'est encodée qu'une fois — elle n'est lue que par `URLSearchParams`.
 */
export function shapeHref(properties: GeoJsonProperties, target: ShapeTarget): string | null {
  const value = shapeValue(properties, target.valueFrom);
  if (value === null) return null;
  const encoded = encodeURIComponent(encodeURIComponent(value));
  return `${target.path}?${encodeURIComponent(target.filterId)}=${encoded}`;
}

/** Une couche est-elle cliquable ? `target.layers` absent = toutes le sont. */
export function isLayerInteractive(layerId: string, target: ShapeTarget): boolean {
  return !target.layers?.length || target.layers.includes(layerId);
}
