// ------------------------------------------------------------
// meeteemGeo.ts — réponses CoForm → entités cartographiables
// ------------------------------------------------------------
// La carte du module search (`SearchMapWrapper`) consomme des entités dont
// `serverData` porte `geo` / `geoPosition` À LA RACINE (cf. `getEntryCoords`).
// Une réponse CoForm, elle, range son adresse SOUS le champ de formulaire
// (`answers.<form>.<champ>` → extrait par `useFetchAnswerQuery` dans
// `card.data.address`). Ce module fait le pont : il remonte l'adresse à la
// racine et projette les champs que lit `useItem` (nom, description, tags,
// image) pour que la popup par défaut soit correcte.
//
// Fonctions PURES (testées sans rendu).

import type { SearchEntity } from "@communecter/cocolight-api-client";
import { parseStoredToEntries } from "@/modules/coform/utils/coformLocality";
import { isValidGeoPoint, toFiniteCoord } from "@/modules/search/lib/searchMapSelection";
import type { MeeteemCard } from "../types";

/**
 * Identifiant STABLE d'une carte Meeteem — partagé par la clé React, la
 * synchro liste↔carte et l'entité carto. Repli sur l'index quand la réponse
 * n'a pas d'id (jamais deux cartes avec le même id dans une même liste).
 */
export function meeteemCardId(card: MeeteemCard, index: number): string {
  const id = card.answer?.serverData?.id;
  return id != null && id !== "" ? String(id) : `meeteem-${index}`;
}

/**
 * Vrai si l'identifiant est un vrai ObjectId de réponse, et non le repli
 * `meeteem-<index>` ci-dessus. Une requête de détail lancée sur ce repli
 * partirait sur un id fantôme et ouvrirait une modale vide.
 */
export function isAnswerId(id: string | null | undefined): id is string {
  return typeof id === "string" && /^[0-9a-f]{24}$/i.test(id);
}

/** Chaîne non vide, sinon `undefined`. */
function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Coordonnées [lng, lat] d'une entrée d'adresse CoForm. Le backend renvoie
 * `geoPosition.coordinates` en STRING (["47.085149", "-21.456444"]) aussi
 * souvent qu'en number → on coerce avant de valider les bornes.
 */
function coordsOf(geoPosition: { coordinates?: unknown } | undefined): [number, number] | null {
  const raw = geoPosition?.coordinates;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  // `toFiniteCoord` rejette chaîne vide et null AVANT le `Number()` : une seule
  // des deux valeurs manquante donnerait sinon un 0 qui passe pour une
  // coordonnée légitime et bloque le repli `geo` ci-dessous.
  const x = toFiniteCoord(raw[0]);
  const y = toFiniteCoord(raw[1]);
  if (x === null || y === null) return null;
  const point = [x, y];
  if (!isValidGeoPoint(point)) return null;
  // `parseStoredToEntries` comble un `geoPosition` ABSENT par le placeholder
  // [0, 0] — et `Number("")` vaut 0. Le retenir placerait au large du Ghana
  // (Null Island) toute réponse dont le champ adresse existe sans coordonnées.
  return point[0] === 0 && point[1] === 0 ? null : point;
}

/**
 * Entité carto d'une réponse, ou `null` si la réponse n'est pas géolocalisée
 * (champ adresse absent, vide, ou ancienne valeur en texte libre — cf.
 * `parseStoredToEntries`). Une réponse peut porter PLUSIEURS adresses : on
 * retient l'adresse principale (`center`), soit exactement un marqueur par
 * réponse.
 */
export function toMeeteemMapEntity(card: MeeteemCard, index: number): SearchEntity | null {
  const entries = parseStoredToEntries(card.data?.address);
  if (entries.length === 0) return null;

  const entry = entries.find((e) => e.center) ?? entries[0];
  // GeoJSON d'abord, repli sur `geo: {latitude, longitude}` — les deux formes
  // coexistent dans la donnée Communecter (cf. `getEntryCoords`).
  const coords =
    coordsOf(entry.geoPosition) ?? coordsOf({ coordinates: [entry.geo?.longitude, entry.geo?.latitude] });
  if (!coords) return null;

  const id = meeteemCardId(card, index);
  const image = str(card.data?.image);

  return {
    // `getEntryId` lit l'id RACINE en premier — les deux sont posés pour que la
    // synchro liste↔carte compare toujours la même valeur.
    id,
    serverData: {
      id,
      collection: "answers",
      name: str(card.data?.name) ?? "",
      shortDescription: str(card.data?.description) ?? "",
      description: str(card.data?.description) ?? "",
      tags: card.data?.tags,
      address: entry.address,
      geo: entry.geo,
      // Coordonnées NUMÉRIQUES normalisées : la carte n'a plus à re-coercer.
      geoPosition: { type: "Point", coordinates: coords },
      ...(image ? { profilMediumImageUrl: image } : {}),
    },
  } as unknown as SearchEntity;
}

export interface MeeteemMapModel {
  /** Entités carto des réponses géolocalisées, dans l'ordre de la liste. */
  entities: SearchEntity[];
  /** Ids des réponses qui ont un marqueur (une carte de la liste sait si elle
   *  est pointable sur la carte sans refaire le parsing). */
  locatedIds: Set<string>;
}

/** Modèle carto de la liste — un SEUL parcours (le parsing d'adresse est le
 *  coût dominant sur un périmètre complet de plusieurs milliers de réponses). */
export function buildMeeteemMapModel(cards: MeeteemCard[]): MeeteemMapModel {
  const entities: SearchEntity[] = [];
  const locatedIds = new Set<string>();

  cards.forEach((card, index) => {
    const entity = toMeeteemMapEntity(card, index);
    if (!entity) return;
    entities.push(entity);
    locatedIds.add(meeteemCardId(card, index));
  });

  return { entities, locatedIds };
}
