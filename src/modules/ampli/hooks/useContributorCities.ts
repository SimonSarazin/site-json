import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { AMPLI_QUERY_KEYS } from "../constants/queryKeys";
import { collectMissingCities } from "../utils/ampliUsersGeo";
import type { ContributorCityRef } from "../utils/ampliUsersGeo";
import type { UserWithContributions } from "../helpers/summary";

/** Une commune ne bouge pas : on la garde très longtemps en cache. */
const CITY_STALE_TIME_MS = 24 * 60 * 60 * 1000;

/** Forme utile d'une ville renvoyée par `cityAutocompleteByCountry`. */
interface CityHit {
  id?: unknown;
  geo?: { latitude?: unknown; longitude?: unknown };
  geoPosition?: { coordinates?: unknown };
}

/** Coordonnée numérique tolérante — l'API renvoie lat/lng en STRING. */
function coord(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.trim()) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) && value !== "" ? n : null;
}

/**
 * Coordonnées [lng, lat] de la commune dont l'`id` correspond au `localityId`.
 *
 * La correspondance se fait sur l'ID, JAMAIS sur le nom : l'autocomplétion est
 * une recherche floue et peut rendre plusieurs communes homonymes — retenir la
 * première placerait le contributeur dans la mauvaise ville.
 */
function pickCity(hits: unknown, localityId: string): [number, number] | null {
  const list: CityHit[] = Array.isArray(hits)
    ? hits
    : hits && typeof hits === "object"
      ? (Object.values(hits) as CityHit[])
      : [];

  const hit = list.find((c) => String(c?.id ?? "") === localityId);
  if (!hit) return null;

  const raw = hit.geoPosition?.coordinates;
  if (Array.isArray(raw) && raw.length >= 2) {
    const lng = coord(raw[0]);
    const lat = coord(raw[1]);
    if (lng !== null && lat !== null) return [lng, lat];
  }
  const lng = coord(hit.geo?.longitude);
  const lat = coord(hit.geo?.latitude);
  return lng !== null && lat !== null ? [lng, lat] : null;
}

export interface ContributorCitiesResult {
  /** `localityId` → [lng, lat]. Vide tant que rien n'est résolu. */
  cityCoords: ReadonlyMap<string, [number, number]>;
  /** Au moins une commune est encore en vol — ne pas conclure « non localisé ». */
  isResolving: boolean;
}

/**
 * Résout en coordonnées les communes des contributeurs qui n'ont PAS de `geo`.
 *
 * Beaucoup de profils Communecter portent une adresse sans géocodage
 * (`addressLocality` + `localityId`, aucun `geo`). L'annuaire les affiche avec
 * leur ville ; les écarter de la carte donnerait moins de points que de fiches,
 * ce que l'utilisateur lit — à juste titre — comme un bug.
 *
 * UNE requête par COMMUNE (pas par contributeur), via `cityAutocompleteByCountry`
 * — le même endpoint que l'éditeur d'adresse (`AddressEditor`). Chaque commune a
 * sa propre entrée de cache : deux sections qui affichent les mêmes villes ne la
 * résolvent qu'une fois.
 *
 * ⚠ La position obtenue est le CENTRE de la commune, pas l'adresse réelle : deux
 * contributeurs d'une même ville se superposent exactement (le clustering les
 * regroupe). C'est le compromis assumé — mieux vaut une position approchée
 * qu'une absence inexpliquée.
 *
 * Dégrade proprement hors `CocolightProvider` (tests) : aucune query.
 */
export function useContributorCities(users: UserWithContributions[]): ContributorCitiesResult {
  const entity = useCocolightOptional()?.entity ?? null;

  const missing = useMemo(() => collectMissingCities(users), [users]);

  const results = useQueries({
    queries: missing.map((city: ContributorCityRef) => ({
      queryKey: AMPLI_QUERY_KEYS.CITY_GEO(city.localityId),
      enabled: !!entity,
      staleTime: CITY_STALE_TIME_MS,
      queryFn: async () => {
        const hits = await entity!.endpointApi.cityAutocompleteByCountry({
          type: "locality",
          scopeValue: city.name,
          formInMap: true,
          countryCode: city.countryCode,
        });
        return pickCity(hits, city.localityId);
      },
    })),
  });

  const isResolving = results.some((r) => r.isPending && !!entity);

  const cityCoords = useMemo(() => {
    const out = new Map<string, [number, number]>();
    missing.forEach((city, i) => {
      const point = results[i]?.data;
      if (point) out.set(city.localityId, point);
    });
    return out;
    // `results` change d'identité à chaque rendu (tableau react-query) — dep
    // volontaire, le recompute est trivial (une boucle sur quelques communes).
  }, [missing, results]);

  return { cityCoords, isResolving };
}
