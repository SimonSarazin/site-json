import { useCallback, useEffect, useMemo } from "react";
import { useQueries, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { Feature, FeatureCollection } from "geojson";

import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import type { GeoShapeSource, GeoShapeStyle } from "@/types/geo-shape-schema";
import type { LocalizedString } from "@/types/locale-schema";

import { geoShapeQueryOptions, type GeoShapeEntity } from "./geoShapeQuery";

/**
 * Couches de contours prêtes à peindre — une par `id` déclaré en config.
 *
 * Deux entrées qui partagent un `id` sont FUSIONNÉES : c'est ainsi qu'on exprime un OU, que le
 * legacy n'a pas (ses filtres sont ANDés). Les doublons de documents sont éliminés au passage.
 */
export interface GeoShapeLayer {
  id: string;
  label?: LocalizedString;
  style?: GeoShapeStyle;
  /** Poser le nom de chaque contour sur la carte (cf. `showNames` en config). */
  showNames?: boolean;
  data: FeatureCollection;
  /** Au moins une des requêtes de la couche n'a pas encore de réponse. */
  isLoading: boolean;
  /**
   * Au moins une des requêtes de la couche a ÉCHOUÉ, ou ne pourra jamais partir (API du site non
   * résolue). Sans ce drapeau, un échec réseau est indiscernable d'un périmètre vide (React Query
   * rend `{isLoading:false, data:undefined}` dans les deux cas) — et une vue affirmerait « aucun
   * contour ici » là où elle n'a rien pu lire.
   */
  isError: boolean;
}

const EMPTY_SOURCES: GeoShapeSource[] = [];
const EMPTY_LAYERS: GeoShapeLayer[] = [];

function combineLayers(
  sources: GeoShapeSource[],
  results: UseQueryResult<FeatureCollection, Error>[],
  apiUnavailable: boolean,
): GeoShapeLayer[] {
  if (sources.length === 0) return EMPTY_LAYERS;

  const byId = new Map<string, { layer: GeoShapeLayer; seen: Set<string> }>();

  sources.forEach((source, index) => {
    const result = results[index];
    let entry = byId.get(source.id);
    if (!entry) {
      entry = {
        layer: {
          id: source.id,
          label: source.label,
          style: source.style,
          showNames: source.showNames,
          data: { type: "FeatureCollection", features: [] as Feature[] },
          isLoading: false,
          isError: false,
        },
        seen: new Set<string>(),
      };
      byId.set(source.id, entry);
    }
    // `isPending` et non `isLoading` : une requête DÉSACTIVÉE faute d'entité reste `pending` sans
    // jamais charger — ni en cours ni en échec pour React Query, elle passerait pour « chargée, vide ».
    if (result?.isPending) {
      if (apiUnavailable) entry.layer.isError = true;
      else entry.layer.isLoading = true;
    }
    if (result?.isError) entry.layer.isError = true;
    for (const feature of result?.data?.features ?? []) {
      const key = feature.id == null ? "" : String(feature.id);
      if (key) {
        if (entry.seen.has(key)) continue;
        entry.seen.add(key);
      }
      entry.layer.data.features.push(feature);
    }
  });

  return Array.from(byId.values(), (entry) => entry.layer);
}

/**
 * Lit les couches déclarées par `map.shapes`. Appelée depuis la CARTE : celle-ci n'est montée
 * qu'en vue carte (lazy + `useClientModule`), ce qui réalise à lui seul le `load: "map"` par
 * défaut. Les politiques `page`/`idle` sont assurées en amont par {@link useGeoShapesWarmup},
 * qui remplit le MÊME cache — la carte trouve alors la donnée déjà là.
 */
export function useGeoShapes(sources: GeoShapeSource[] | undefined): GeoShapeLayer[] {
  const { entity } = useCocolight();
  const hydrated = useHydrated();
  const list = sources ?? EMPTY_SOURCES;
  // Sans entité, rien ne partira : c'est une PANNE — mais seulement une fois hydraté. Avant, le
  // serveur et le 1er rendu client doivent sortir le même squelette : le client résout sa propre
  // entité, et peut réussir là où le serveur a échoué.
  const apiUnavailable = hydrated && !entity;
  // React Query ne rejoue `combine` que si SA référence ou celle des `results` change. Inline, il
  // serait recréé à chaque render : la fusion des couches, puis la comparaison profonde de toutes
  // les géométries (`replaceEqualDeep`), se rejoueraient à chaque pan, zoom ou survol de la carte.
  const combine = useCallback(
    (results: UseQueryResult<FeatureCollection, Error>[]) => combineLayers(list, results, apiUnavailable),
    [list, apiUnavailable],
  );

  return useQueries({
    queries: list.map((source) => ({
      ...geoShapeQueryOptions((entity as GeoShapeEntity | null) ?? null, source),
      enabled: Boolean(entity),
    })),
    combine,
  });
}

/**
 * Préchauffage déclaratif, à appeler depuis la SECTION (toujours montée, elle, contrairement à
 * la carte) :
 *  - `load: "page"` → dès l'hydratation ;
 *  - `load: "idle"` → à la première fenêtre d'inactivité (repli `setTimeout` : `requestIdleCallback`
 *    manque encore sur certains Safari), donc APRÈS le premier paint — la liste garde le chemin
 *    critique pour elle ;
 *  - `load: "map"` (défaut) ou absent → NO-OP : rien n'est payé par qui reste en liste.
 *
 * Jamais de SSR : `getzoniris` est un POST (aucun cache HTTP) et déshydrater des polygones dans
 * le HTML coûterait plus que la page entière (mesuré : 395 Ko pour 7 bassins de vie).
 */
export function useGeoShapesWarmup(sources: GeoShapeSource[] | undefined): void {
  const { entity } = useCocolight();
  const queryClient = useQueryClient();
  const hydrated = useHydrated();

  // Signature sérialisée : l'effet ne dépend que du CONTENU des couches à préchauffer. La référence
  // de `map.shapes` est stable tant que la config l'est (elle vit dans l'état de `SiteProvider`),
  // mais une config remplacée à chaud (`setConfig`) en recrée une à contenu égal : pas de second
  // préchauffage pour autant.
  const signature = useMemo(
    () => JSON.stringify((sources ?? []).filter((source) => source.load === "page" || source.load === "idle")),
    [sources],
  );

  useEffect(() => {
    if (!hydrated || !entity) return;
    const eager = JSON.parse(signature) as GeoShapeSource[];
    if (eager.length === 0) return;

    const prefetch = (source: GeoShapeSource) =>
      void queryClient.prefetchQuery(geoShapeQueryOptions(entity as unknown as GeoShapeEntity, source));

    eager.filter((source) => source.load === "page").forEach(prefetch);

    const idleSources = eager.filter((source) => source.load === "idle");
    if (idleSources.length === 0) return;

    const run = () => idleSources.forEach(prefetch);
    const idleCallback = (window as unknown as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number })
      .requestIdleCallback;
    if (typeof idleCallback === "function") {
      const handle = idleCallback(run, { timeout: 3000 });
      return () => (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(run, 1200);
    return () => window.clearTimeout(timer);
  }, [hydrated, entity, signature, queryClient]);
}
