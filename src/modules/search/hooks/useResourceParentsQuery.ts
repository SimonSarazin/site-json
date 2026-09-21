import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GlobalAutocompleteCostumData, PaginatorPage } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import type { ResourceParentInfo } from "../contexts/resourceDirectory";

interface SearchCostumEntity {
  searchCostum(data?: Partial<GlobalAutocompleteCostumData>): Promise<PaginatorPage<unknown>>;
}

export interface UseResourceParentsOptions {
  costumSlug?: string;
  contextId?: string;
  contextType?: string;
  enabled?: boolean;
}

const EMPTY: Map<string, ResourceParentInfo> = new Map();

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Id 24-hex d'un document, quel que soit l'encodage (`$id`/`$oid`/string). */
function docId(sd: Record<string, unknown>): string | undefined {
  const raw = sd._id;
  if (typeof raw === "string") return raw || undefined;
  const o = raw as { $id?: string; $oid?: string; _str?: string } | undefined;
  return o?.$id ?? o?.$oid ?? o?._str ?? undefined;
}

function coordsOf(sd: Record<string, unknown>): { lat: number; lng: number } | null {
  const geo = sd.geo as Record<string, unknown> | undefined;
  const lat = Number(geo?.latitude);
  const lng = Number(geo?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
  const gp = sd.geoPosition as { coordinates?: unknown[] } | undefined;
  const c = gp?.coordinates;
  if (Array.isArray(c) && c.length === 2 && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))) {
    // GeoJSON : [lng, lat]
    return { lat: Number(c[1]), lng: Number(c[0]) };
  }
  return null;
}

/**
 * Résout EN UN APPEL les tiers-lieux porteurs (`_id: {$in: ids}`) d'un lot de
 * ressources : nom, slug, image, ville, `address.level1` (garde région) et
 * coordonnées. Pendant client de la remontée serveur que fait
 * `Navigator::getRessourceTL` (`PHDB::findOneById(... profilImageUrl, address, geo)`).
 */
export function useResourceParentsQuery(ids: string[], opts: UseResourceParentsOptions = {}) {
  const { entity } = useCocolight();
  const sortedIds = useMemo(
    () => Array.from(new Set(ids.filter((id): id is string => !!id))).sort(),
    [ids],
  );

  const result = useQuery<Map<string, ResourceParentInfo>, Error>({
    queryKey: ["resource-parents", opts.costumSlug ?? "", sortedIds],
    queryFn: async () => {
      if (!entity || sortedIds.length === 0) return EMPTY;
      const page = await (entity as unknown as SearchCostumEntity).searchCostum({
        name: "",
        indexMin: 0,
        indexStep: Math.min(sortedIds.length, 500),
        searchType: ["organizations"],
        filters: { _id: { $in: sortedIds } },
        fields: ["name", "slug", "profilImageUrl", "address", "geo", "geoPosition"],
        notSourceKey: true,
        ...(opts.costumSlug ? { costumSlug: opts.costumSlug } : {}),
        ...(opts.contextId ? { contextId: opts.contextId } : {}),
        ...(opts.contextType
          ? { contextType: opts.contextType as GlobalAutocompleteCostumData["contextType"] }
          : {}),
      } as Partial<GlobalAutocompleteCostumData>);

      const map = new Map<string, ResourceParentInfo>();
      for (const r of (page?.results ?? []) as Array<Record<string, unknown>>) {
        const sd = (r.serverData ?? r) as Record<string, unknown>;
        const id = docId(sd);
        if (!id) continue;
        const addr = sd.address as Record<string, unknown> | undefined;
        map.set(id, {
          id,
          name: str(sd.name),
          slug: str(sd.slug),
          imageUrl: str(sd.profilImageUrl),
          streetAddress: str(addr?.streetAddress),
          postalCode: str(addr?.postalCode),
          addressLocality: str(addr?.addressLocality),
          level1: str(addr?.level1),
          coords: coordsOf(sd),
        });
      }
      return map;
    },
    enabled: (opts.enabled ?? true) && !!entity && sortedIds.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  return {
    parents: result.data ?? EMPTY,
    isLoading: result.isLoading,
    isFetched: result.isFetched,
  };
}
