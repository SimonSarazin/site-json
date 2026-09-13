// ------------------------------------------------------------
// ampliUsersGeo.ts — contributeurs ampli → entités cartographiables
// ------------------------------------------------------------
// Pendant de `meeteemGeo` pour le tab « community ». La différence est de
// NATURE, pas de forme : `meeteemGeo` géolocalise des RÉPONSES (adresse rangée
// sous un champ de formulaire), ici on géolocalise leurs AUTEURS. Réutiliser
// `buildMeeteemMapModel` donnerait une carte de réponses — donc plusieurs
// marqueurs pour un même contributeur, et aucun pour ceux dont la réponse n'a
// pas d'adresse alors qu'eux en ont une.
//
// Bonne nouvelle côté données : `coformAnswersSearch` projette déjà l'auteur
// avec `geo` / `geoPosition` / `address` À LA RACINE de son `serverData` —
// exactement la forme que lit `getEntryCoords`. Aucune requête supplémentaire.
//
// Fonctions PURES (testées sans rendu).

import type { SearchEntity } from "@communecter/cocolight-api-client";
import { isValidGeoPoint, toFiniteCoord } from "@/modules/search/lib/searchMapSelection";
import type { UserWithContributions } from "../helpers/summary";

/** `serverData` d'un contributeur, tel que projeté par `coformAnswersSearch`. */
interface ContributorServerData {
  id?: unknown;
  _id?: unknown;
  slug?: unknown;
  name?: unknown;
  description?: unknown;
  profilMediumImageUrl?: unknown;
  profilThumbImageUrl?: unknown;
  address?: ContributorAddress;
  geo?: { latitude?: unknown; longitude?: unknown };
  geoPosition?: { coordinates?: unknown };
}

/** Adresse postale Communecter — seuls les champs utiles ici. */
interface ContributorAddress {
  addressLocality?: unknown;
  addressCountry?: unknown;
  /** `_id` de la commune en base — clé de résolution des coordonnées. */
  localityId?: unknown;
  [key: string]: unknown;
}

/** Commune à résoudre pour placer un contributeur qui n'a pas de coordonnées. */
export interface ContributorCityRef {
  /** `_id` de la commune : clé de cache ET critère de correspondance. */
  localityId: string;
  /** Nom de la commune — c'est LUI que l'autocomplétion interroge. */
  name: string;
  /** Code pays ISO, requis par `cityAutocompleteByCountry`. */
  countryCode: string;
}

/** Chaîne non vide, sinon `undefined`. */
function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Vrai si la valeur est un ObjectId Mongo en hexadécimal nu. */
function isHexId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{24}$/i.test(value);
}

/**
 * Identifiant du contributeur — clé React du marqueur, signature du recadrage
 * et cible de la synchro focus. Doit être STABLE et UNIQUE.
 *
 * ⚠ Surtout PAS `String(serverData._id)` : `_id` est une instance `ObjectID`
 * dont `toString()` rend `ObjectID("<hex>")` et non le hex nu (cf. EJSONType du
 * SDK) — c'est le piège dans lequel tombe déjà `getSummaryData` pour sa clé de
 * regroupement. On lit donc `id` (posé par la normalisation du SDK) et on ne
 * déplie `_id` qu'en repli, dans ses trois formes possibles.
 */
export function contributorId(serverData: ContributorServerData | undefined): string | undefined {
  if (isHexId(serverData?.id)) return serverData.id;
  const raw = serverData?._id;
  if (isHexId(raw)) return raw;
  if (raw && typeof raw === "object") {
    const wrapped = raw as { _str?: unknown; $id?: unknown };
    if (isHexId(wrapped._str)) return wrapped._str;
    if (isHexId(wrapped.$id)) return wrapped.$id;
  }
  return undefined;
}

/**
 * Coordonnées [lng, lat] du contributeur, ou `null`.
 *
 * `geoPosition.coordinates` (GeoJSON) d'abord, repli sur `geo:{latitude,
 * longitude}` — les deux coexistent dans la donnée Communecter et arrivent
 * indifféremment en nombre ou en STRING ("-21.8291434"), d'où la coercition.
 */
function pointOf(lng: unknown, lat: unknown): [number, number] | null {
  // `toFiniteCoord` (coercition CANONIQUE du dépôt) rejette chaîne vide et null
  // AVANT le `Number()`. Sans lui, une seule des deux valeurs manquante devient
  // 0 : le point reste « valide » et différent de [0, 0], donc il est retenu et
  // court-circuite le repli `geo` — le contributeur atterrit dans le golfe de
  // Guinée au lieu de sa vraie position.
  const x = toFiniteCoord(lng);
  const y = toFiniteCoord(lat);
  if (x === null || y === null) return null;

  const point = [x, y];
  if (!isValidGeoPoint(point)) return null;
  // Null Island. `getEntryCoords` accepte [0, 0] comme un point valide et
  // `Number("")` vaut 0 : un champ géo présent mais vide placerait le
  // contributeur au large du Ghana. Même garde que `meeteemGeo`.
  //
  // Ce rejet DOIT vivre ici, dans la sélection, et pas après elle : l'API
  // renvoie couramment un `geoPosition` vide À CÔTÉ d'un `geo` renseigné.
  // Valider d'abord puis rejeter [0, 0] laisserait ce placeholder l'emporter
  // sur le repli, et perdrait un contributeur pourtant géolocalisé.
  return point[0] === 0 && point[1] === 0 ? null : point;
}

function contributorCoords(
  serverData: ContributorServerData,
  cityCoords?: ReadonlyMap<string, [number, number]>,
): [number, number] | null {
  const raw = serverData.geoPosition?.coordinates;
  const fromGeoJson = Array.isArray(raw) && raw.length >= 2 ? pointOf(raw[0], raw[1]) : null;
  const own = fromGeoJson ?? pointOf(serverData.geo?.longitude, serverData.geo?.latitude);
  if (own) return own;

  // Repli COMMUNE : beaucoup de profils Communecter portent une adresse sans
  // aucune coordonnée (`addressLocality` + `localityId`, pas de `geo`). Les
  // écarter de la carte serait incompréhensible côté utilisateur — l'annuaire,
  // lui, les affiche avec leur ville. On les place donc au centre de leur
  // commune, résolu par `useContributorCities`.
  const localityId = str(serverData.address?.localityId);
  return localityId ? cityCoords?.get(localityId) ?? null : null;
}

/**
 * Communes à résoudre : contributeurs SANS coordonnées propres mais dont
 * l'adresse porte une commune identifiée. Dédupliquées par `localityId` (une
 * seule requête par commune, quel que soit le nombre de contributeurs) et dans
 * un ordre STABLE — `useQueries` exige un nombre et un ordre constants.
 */
export function collectMissingCities(users: UserWithContributions[]): ContributorCityRef[] {
  const out: ContributorCityRef[] = [];
  const seen = new Set<string>();

  users.forEach((entry) => {
    const sd = serverDataOf(entry.user);
    if (!sd || contributorCoords(sd)) return;

    const localityId = str(sd.address?.localityId);
    const name = str(sd.address?.addressLocality);
    const countryCode = str(sd.address?.addressCountry);
    if (!localityId || !name || !countryCode || seen.has(localityId)) return;

    seen.add(localityId);
    out.push({ localityId, name, countryCode });
  });

  return out;
}

/** Narrowing : `getSummaryData` peut rendre une string (auteur non résolu) ou `null`. */
function serverDataOf(user: UserWithContributions["user"]): ContributorServerData | null {
  if (!user || typeof user !== "object" || !("serverData" in user)) return null;
  const sd = (user as { serverData?: unknown }).serverData;
  return sd && typeof sd === "object" ? (sd as ContributorServerData) : null;
}

/**
 * Entité carto d'un contributeur, ou `null` s'il n'est pas géolocalisable
 * (auteur non résolu, sans id, ou sans coordonnées valides).
 *
 * Les champs sont posés SEULEMENT s'ils sont non vides : `useItem` fusionne ses
 * défauts par spread (`{...defaults, ...serverData}`), donc poser `name:
 * undefined` ÉCRASE le repli « Nom inconnu » et rend un titre de popup vide.
 *
 * @param options - `formatContributions` : libellé du nombre de contributions,
 *   injecté pour garder cette fonction PURE (la traduction vit dans le
 *   composant) ; il occupe `shortDescription`, seul champ de texte libre que
 *   rend la popup. `cityCoords` : coordonnées par commune, pour placer les
 *   contributeurs qui n'ont qu'une adresse.
 */
export function toContributorMapEntity(
  entry: UserWithContributions,
  options: ContributorMapOptions = {},
): SearchEntity | null {
  const sd = serverDataOf(entry.user);
  if (!sd) return null;

  const id = contributorId(sd);
  if (!id) return null;

  const coords = contributorCoords(sd, options.cityCoords);
  if (!coords) return null;

  const name = str(sd.name);
  // Le libellé de contributions prime sur la bio : la projection backend de
  // l'auteur ne porte pas `description` aujourd'hui, mais si elle l'apportait,
  // c'est bien le compteur qui doit rester visible sur cette carte.
  const description = options.formatContributions?.(entry.contributionCount) ?? str(sd.description);
  const slug = str(sd.slug);
  // Le MARQUEUR (`useItemImage`) lit `profilThumbImageUrl` puis
  // `profilMediumImageUrl` ; la POPUP (`useItem`) les lit dans l'ordre inverse.
  // On relaie les deux tels quels pour que les deux chaînes aboutissent.
  const thumb = str(sd.profilThumbImageUrl);
  const medium = str(sd.profilMediumImageUrl);

  return {
    // `getEntryId` lit l'id RACINE en premier : le poser aux deux niveaux évite
    // que le recadrage et la synchro comparent des valeurs différentes.
    id,
    ...(slug ? { slug } : {}),
    serverData: {
      id,
      collection: "citoyens",
      ...(name ? { name } : {}),
      ...(description ? { shortDescription: description } : {}),
      ...(slug ? { slug } : {}),
      ...(thumb ? { profilThumbImageUrl: thumb } : {}),
      ...(medium ? { profilMediumImageUrl: medium } : {}),
      ...(sd.address && typeof sd.address === "object" ? { address: sd.address } : {}),
      // Coordonnées NUMÉRIQUES normalisées : la carte n'a plus à re-coercer.
      geoPosition: { type: "Point", coordinates: coords },
    },
  } as unknown as SearchEntity;
}

export interface ContributorMapOptions {
  /** Libellé du nombre de contributions (traduction injectée — cf. pureté). */
  formatContributions?: (count: number) => string;
  /** `localityId` → [lng, lat], pour les contributeurs sans coordonnées propres. */
  cityCoords?: ReadonlyMap<string, [number, number]>;
}

export interface ContributorsMapModel {
  /** Entités carto des contributeurs géolocalisés, dans l'ordre de la liste. */
  entities: SearchEntity[];
  /** Combien sont réellement placés sur la carte. */
  located: number;
  /** Combien de contributeurs au total (localisés ou non). */
  total: number;
}

/**
 * Modèle carto des contributeurs.
 *
 * `located` / `total` ne sont pas décoratifs : une entité sans coordonnées est
 * silencieusement écartée par `SearchMap`, et sur ce tab un contributeur non
 * localisé est le cas NOMINAL (l'adresse Communecter est souvent renseignée
 * sans géocodage). Sans ce compteur, la carte mentirait par omission.
 *
 * Déduplication : `getSummaryData` regroupe déjà les réponses par auteur, mais
 * on reste défensif ici — un id vu deux fois produirait deux `key` React
 * identiques et deux marqueurs empilés au pixel près.
 */
export function buildContributorsMapModel(
  users: UserWithContributions[],
  options: ContributorMapOptions = {},
): ContributorsMapModel {
  const entities: SearchEntity[] = [];
  const seen = new Set<string>();

  users.forEach((entry) => {
    const entity = toContributorMapEntity(entry, options);
    if (!entity) return;
    const id = String((entity as unknown as { id: string }).id);
    if (seen.has(id)) return;
    seen.add(id);
    entities.push(entity);
  });

  return { entities, located: entities.length, total: users.length };
}
