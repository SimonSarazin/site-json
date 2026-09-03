// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Point } from "geojson";

import type { GeoShapeSource } from "@/types/geo-shape-schema";

/**
 * Source `optionsFrom.shapes` : le référentiel de contours peuple les options.
 *
 * Deux propriétés à tenir, et ce sont les deux raisons d'être de la source :
 *  - l'option est IDENTIFIÉE par l'`_id` du document et LIBELLÉE par son `name` — c'est ce qui
 *    permet de filtrer sur `address.zonirisId`, qu'un renommage en base ne bouge pas ;
 *  - la requête est celle de la carte, à la clé près : une couche déjà chargée par la page ne
 *    provoque aucun second appel.
 */

// Un document tel que le legacy le rend : géométrie NUE, `_id` enveloppé.
const carre = (dx: number) => ({
  type: "Polygon",
  coordinates: [[[dx, 0], [dx + 1, 0], [dx + 1, 1], [dx, 1], [dx, 0]]],
});

const getZoniris = vi.fn(async () => [
  { _id: { $id: "6a5f1ea7cfef38454098cbb2" }, name: "Saint Paul centre", geoShape: carre(0) },
  { _id: { $id: "6a5f1eeddfc32aeb4f68bcc3" }, name: "Saint Gilles les Bains", geoShape: carre(2) },
  // Sans contour : écarté en amont par `toFeatureCollection` — une option muette sur la carte
  // n'aurait de toute façon rien à filtrer.
  { _id: { $id: "6a5f1eeddfc32aeb4f68bcc5" }, name: "Sans contour" },
]);

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ api: null, entity: { getZoniris, serverData: { slug: "saintpaulSport1" } } }),
}));

import { useDynamicFilterOptions, optionsDepuisContours } from "./useDynamicFilterOptions";

const SOURCE: GeoShapeSource = {
  id: "bassins-vie",
  source: "zoniris",
  simplify: 10,
  filters: { spec: "bassins_vie_saintpaul" },
};

const POINT: Point = { type: "Point", coordinates: [0, 0] };

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useDynamicFilterOptions — source `shapes`", () => {
  it("peuple les options avec l'_id du contour et le nom en libellé", async () => {
    const filtres = [{ id: "poi-zoniris", options: [], optionsFrom: { shapes: SOURCE } }];
    const { result } = renderHook(() => useDynamicFilterOptions(filtres), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current[0].optionsReady).toBe(true));
    expect(result.current[0].options).toEqual([
      {
        id: "6a5f1ea7cfef38454098cbb2",
        label: "Saint Paul centre",
        value: "6a5f1ea7cfef38454098cbb2",
        name: "6a5f1ea7cfef38454098cbb2",
      },
      {
        id: "6a5f1eeddfc32aeb4f68bcc3",
        label: "Saint Gilles les Bains",
        value: "6a5f1eeddfc32aeb4f68bcc3",
        name: "6a5f1eeddfc32aeb4f68bcc3",
      },
    ]);
    expect(getZoniris).toHaveBeenCalledWith({ spec: "bassins_vie_saintpaul" });
  });

  it("rend un tableau d'options même AVANT réception — une config sans `options` ne casse pas", () => {
    // La config n'est pas parsée au runtime : le `default([])` du schéma ne s'applique pas, et
    // `SearchHeaderSection` lit `filter.options.filter(...)` sans garde. Sans cette normalisation,
    // un filtre déclarant uniquement `optionsFrom` faisait tomber la barre de filtres entière.
    const filtres = [{ id: "poi-zoniris", optionsFrom: { shapes: SOURCE } }];
    const { result } = renderHook(() => useDynamicFilterOptions(filtres), { wrapper: makeWrapper() });

    expect(result.current[0].options).toEqual([]);
    expect(result.current[0].optionsReady).toBe(false);
  });

  it("laisse passer un filtre sans `optionsFrom`, sans aucune requête", async () => {
    const declarees = [{ id: "97411", label: "Bois-de-Nèfles", value: "97411" }];
    const filtres = [{ id: "poi-postalCode", options: declarees }];
    const { result } = renderHook(() => useDynamicFilterOptions(filtres), { wrapper: makeWrapper() });

    expect(result.current[0].optionsReady).toBe(true);
    expect(result.current[0].options).toBe(declarees);
  });
});

describe("optionsDepuisContours", () => {
  it("retombe sur l'_id quand le contour n'a pas de nom — jamais d'option muette", () => {
    expect(
      optionsDepuisContours({
        type: "FeatureCollection",
        features: [
          { type: "Feature", id: "abc", geometry: POINT, properties: { name: "  " } },
          { type: "Feature", id: "def", geometry: POINT, properties: {} },
        ],
      }),
    ).toEqual([
      { id: "abc", label: "abc", value: "abc", name: "abc" },
      { id: "def", label: "def", value: "def", name: "def" },
    ]);
  });
});
