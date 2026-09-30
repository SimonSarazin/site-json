// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZoneShapeItem } from "@communecter/cocolight-api-client";

import type { GeoShapeSource } from "@/types/geo-shape-schema";

import type { GeoShapeEntity } from "./geoShapeQuery";
import { useGeoShapes, type GeoShapeLayer } from "./useGeoShapes";

/**
 * Ce que garantit ce fichier : la fusion des couches n'est PAS rejouée à chaque render. La carte
 * re-rend à chaque pan, zoom ou survol ; si `combine` change de référence, React Query refusionne
 * les couches puis compare en profondeur toutes les géométries (`replaceEqualDeep`) — sans que rien
 * ne se voie, sinon au profileur.
 */

const entity: GeoShapeEntity = {
  getZoneShape: async () => [],
  getZoniris: async () =>
    [
      { id: "a1", name: "Bassin", geoShape: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
    ] as ZoneShapeItem[],
};
const contexte: { entity: GeoShapeEntity | null } = { entity };
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => contexte }));

beforeEach(() => {
  contexte.entity = entity;
});

function monterClient() {
  // Client créé UNE fois : un wrapper qui l'instancie à chaque render viderait le cache.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const BASSINS: GeoShapeSource = { id: "bassins", source: "zoniris", filters: { spec: "bassins_vie_saintpaul" } };

describe("useGeoShapes — API du site non résolue", () => {
  // Sans entité, la requête est DÉSACTIVÉE : `pending` sans jamais charger, ni `isLoading` ni
  // `isError` pour React Query. Lue telle quelle, la couche passait pour « chargée, vide ».

  it("premier rendu : en chargement, comme le HTML serveur — jamais « chargée, vide »", () => {
    contexte.entity = null;
    const rendus: GeoShapeLayer[][] = [];
    renderHook(
      () => {
        const couches = useGeoShapes([BASSINS]);
        rendus.push(couches);
        return couches;
      },
      { wrapper: monterClient() },
    );

    expect(rendus[0][0]).toMatchObject({ isLoading: true, isError: false });
  });

  it("une fois hydraté, sans entité, rien ne partira : la couche est en PANNE", async () => {
    contexte.entity = null;
    const { result } = renderHook(() => useGeoShapes([BASSINS]), { wrapper: monterClient() });

    await waitFor(() => expect(result.current[0]).toMatchObject({ isLoading: false, isError: true }));
    expect(result.current[0].data.features).toEqual([]);
  });

  it("avec l'entité, la couche charge puis porte ses contours", async () => {
    const { result } = renderHook(() => useGeoShapes([BASSINS]), { wrapper: monterClient() });

    await waitFor(() => expect(result.current[0].data.features).toHaveLength(1));
    expect(result.current[0]).toMatchObject({ isLoading: false, isError: false });
  });
});

describe("useGeoShapes — mémoïsation de la fusion", () => {
  it("un re-render sans nouvelle donnée ne refusionne pas les couches", async () => {
    let fusions = 0;
    const source = {
      id: "bassins",
      source: "zoniris",
      filters: { spec: "bassins_vie_saintpaul" },
      // Seule la fusion (`combineLayers`) lit `showNames` : chaque lecture compte une fusion.
      get showNames() {
        fusions += 1;
        return false;
      },
    } as GeoShapeSource;
    const sources = [source];

    const { result, rerender } = renderHook(() => useGeoShapes(sources), { wrapper: monterClient() });
    await waitFor(() => expect(result.current[0].data.features).toHaveLength(1));

    const avant = fusions;
    rerender();
    rerender();
    rerender();
    expect(fusions).toBe(avant);
  });
});
