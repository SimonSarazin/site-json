import { describe, expect, it, vi } from "vitest";
import type { Geometry } from "geojson";
import type { ZoneShapeItem } from "@communecter/cocolight-api-client";

import type { GeoShapeSource } from "@/types/geo-shape-schema";

import { countPositions, simplifyGeometry } from "./simplifyGeometry";
import { polygonArea, polygonLabelPoint } from "./labelPoint";
import { fetchGeoShapes, geoShapesQueryKey, toFeatureCollection, type GeoShapeEntity } from "./geoShapeQuery";

const ZONIRIS: GeoShapeSource = {
  id: "bassins-vie",
  source: "zoniris",
  filters: { spec: "bassins_vie_saintpaul" },
};

/** Anneau dense : un carré dont chaque côté est sur-échantillonné (le défaut des contours legacy). */
function densifiedSquare(steps = 50): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) ring.push([55.28 + (0.01 * i) / steps, -21.01]);
  for (let i = 0; i < steps; i++) ring.push([55.29, -21.01 + (0.01 * i) / steps]);
  for (let i = 0; i < steps; i++) ring.push([55.29 - (0.01 * i) / steps, -21.0]);
  for (let i = 0; i < steps; i++) ring.push([55.28, -21.0 - (0.01 * i) / steps]);
  ring.push([55.28, -21.01]);
  return ring;
}

function polygon(ring: [number, number][]): Geometry {
  return { type: "Polygon", coordinates: [ring] };
}

describe("simplifyGeometry", () => {
  it("rend la géométrie INCHANGÉE sans tolérance (le défaut est le contour brut)", () => {
    const geometry = polygon(densifiedSquare());
    expect(simplifyGeometry(geometry, 0)).toBe(geometry);
    expect(simplifyGeometry(geometry, -1)).toBe(geometry);
  });

  it("supprime les points alignés et garde les sommets", () => {
    const geometry = polygon(densifiedSquare());
    const before = countPositions(geometry);
    const after = simplifyGeometry(geometry, 10);

    expect(countPositions(after)).toBeLessThan(before / 5);
    // Les 4 coins du carré survivent : c'est ce que Douglas-Peucker protège.
    const ring = (after as unknown as { coordinates: [number, number][][] }).coordinates[0];
    for (const corner of [
      [55.28, -21.01],
      [55.29, -21.01],
      [55.29, -21.0],
    ]) {
      expect(ring.some(([x, y]) => Math.abs(x - corner[0]) < 1e-6 && Math.abs(y - corner[1]) < 1e-6)).toBe(true);
    }
  });

  it("arrondit à 5 décimales (~1 m) quand elle simplifie", () => {
    const ring = densifiedSquare().map(([x, y]) => [x + 0.000_000_123_456, y] as [number, number]);
    const after = simplifyGeometry(polygon(ring), 10) as unknown as { coordinates: [number, number][][] };
    for (const [x, y] of after.coordinates[0]) {
      expect(x).toBe(Number(x.toFixed(5)));
      expect(y).toBe(Number(y.toFixed(5)));
    }
  });

  it("ne descend jamais un anneau sous 4 points (un polygone fermé n'en a pas moins)", () => {
    const tiny = polygon([
      [55.28, -21.01],
      [55.2801, -21.01],
      [55.2801, -21.0099],
      [55.28, -21.01],
    ]);
    // 10 km de tolérance : tout est « négligeable », l'anneau doit malgré tout rester valide.
    const after = simplifyGeometry(tiny, 10_000) as unknown as { coordinates: [number, number][][] };
    expect(after.coordinates[0].length).toBeGreaterThanOrEqual(4);
  });

  it("traite les MultiPolygon anneau par anneau", () => {
    const multi: Geometry = { type: "MultiPolygon", coordinates: [[densifiedSquare()], [densifiedSquare()]] };
    expect(countPositions(simplifyGeometry(multi, 10))).toBeLessThan(countPositions(multi) / 5);
  });
});

describe("toFeatureCollection", () => {
  const items = [
    { id: "aaaaaaaaaaaaaaaaaaaaaaa1", name: "Saint Paul centre", insee: "97415", geoShape: polygon(densifiedSquare(4)) },
    // Sans contour : très courant (sur zoniris, `insee` ramène 54 documents pour 24 contours).
    { id: "aaaaaaaaaaaaaaaaaaaaaaa2", name: "IRIS sans contour" },
    // Géométrie ponctuelle : rien à peindre.
    { id: "aaaaaaaaaaaaaaaaaaaaaaa3", name: "Point", geoShape: { type: "Point", coordinates: [55.28, -21.01] } },
    // Coordonnées en CHAÎNES : la même base mélange `double` et `string` selon l'import.
    {
      id: "aaaaaaaaaaaaaaaaaaaaaaa4",
      name: "Contour en chaînes",
      country: "RE",
      geoShape: { type: "Polygon", coordinates: [[["55.28", "-21.01"], ["55.29", "-21.01"], ["55.29", "-21.0"], ["55.28", "-21.01"]]] },
    },
    // Coordonnée cassée : on jette la géométrie entière plutôt qu'un contour à trous silencieux.
    {
      id: "aaaaaaaaaaaaaaaaaaaaaaa5",
      name: "Contour cassé",
      geoShape: { type: "Polygon", coordinates: [[[55.28, -21.01], ["n/a", -21.01], [55.29, -21.0], [55.28, -21.01]]] },
    },
  ] as unknown as ZoneShapeItem[];

  it("ne garde que les documents réellement dessinables", () => {
    const fc = toFeatureCollection(items, ZONIRIS);
    expect(fc.features.map((f) => f.id)).toEqual(["aaaaaaaaaaaaaaaaaaaaaaa1", "aaaaaaaaaaaaaaaaaaaaaaa4"]);
  });

  it("coerce les coordonnées en chaînes", () => {
    const fc = toFeatureCollection(items, ZONIRIS);
    const geometry = fc.features[1].geometry as unknown as { coordinates: [number, number][][] };
    expect(geometry.coordinates[0][0]).toEqual([55.28, -21.01]);
  });

  it("dédoublonne par _id — deux entrées de même `id` de couche forment un OU qui se recouvre", () => {
    const doubled = [...items, ...items];
    expect(toFeatureCollection(doubled, ZONIRIS).features).toHaveLength(2);
  });

  it("expose les propriétés utiles et n'invente pas de champ pays commun", () => {
    const fc = toFeatureCollection(items, ZONIRIS);
    expect(fc.features[0].properties).toMatchObject({
      layer: "bassins-vie",
      name: "Saint Paul centre",
      insee: "97415",
      collection: "zoniris",
    });
    // `zones` nomme le pays `countryCode`, `cities` le nomme `country` : les deux alimentent le champ.
    expect(fc.features[1].properties?.countryCode).toBe("RE");
  });
});

describe("geoShapesQueryKey", () => {
  it("est stable pour la même donnée et distingue les tolérances", () => {
    expect(geoShapesQueryKey(ZONIRIS)).toEqual(geoShapesQueryKey({ ...ZONIRIS, id: "autre-habillage" }));
    expect(geoShapesQueryKey({ ...ZONIRIS, simplify: 10 })).not.toEqual(geoShapesQueryKey(ZONIRIS));
  });

  it("normalise le pays : scalaire, liste d'un seul, et ordre des codes décrivent UN seul appel", () => {
    const zones = (countryCode: string | string[]): GeoShapeSource => ({
      id: "regions",
      source: "zones",
      filters: { countryCode, level: "3" },
    });
    // Sans normalisation, `"FR"` et `["FR"]` ouvriraient deux entrées de cache pour la même
    // donnée, et `["FR","RE"]` / `["RE","FR"]` une troisième et une quatrième.
    expect(geoShapesQueryKey(zones("FR"))).toEqual(geoShapesQueryKey(zones(["FR"])));
    expect(geoShapesQueryKey(zones(["FR", "RE"]))).toEqual(geoShapesQueryKey(zones(["RE", "FR"])));
    expect(geoShapesQueryKey(zones(["FR", "RE"]))).not.toEqual(geoShapesQueryKey(zones("FR")));
  });
});

describe("fetchGeoShapes", () => {
  function fakeEntity(): GeoShapeEntity & { getZoneShape: ReturnType<typeof vi.fn>; getZoniris: ReturnType<typeof vi.fn> } {
    return {
      getZoneShape: vi.fn().mockResolvedValue([]),
      getZoniris: vi.fn().mockResolvedValue([]),
    };
  }

  it("route zoniris vers getZoniris avec ses filtres", async () => {
    const entity = fakeEntity();
    await fetchGeoShapes(entity, ZONIRIS);
    expect(entity.getZoniris).toHaveBeenCalledWith({ spec: "bassins_vie_saintpaul" });
    expect(entity.getZoneShape).not.toHaveBeenCalled();
  });

  it("traduit source:'cities' en level:'cities' — le détour du legacy ne remonte pas en config", async () => {
    const entity = fakeEntity();
    await fetchGeoShapes(entity, {
      id: "communes",
      source: "cities",
      filters: { countryCode: "RE", parentId: "58be4af494ef47df1d0ddbcc", parentLevel: "4", light: true },
    });
    expect(entity.getZoneShape).toHaveBeenCalledWith({
      countryCode: "RE",
      level: "cities",
      parentId: "58be4af494ef47df1d0ddbcc",
      parentLevel: "4",
      light: "1",
    });
  });

  it("passe le level des zones tel quel, et n'émet `light` que s'il est demandé", async () => {
    const entity = fakeEntity();
    await fetchGeoShapes(entity, { id: "qpv", source: "zones", filters: { countryCode: "FR", level: "QPV", parentId: "x", parentLevel: "5" } });
    expect(entity.getZoneShape).toHaveBeenCalledWith({ countryCode: "FR", level: "QPV", parentId: "x", parentLevel: "5" });
  });

  it("éclate un countryCode MULTIPLE en un appel par pays, et fusionne les contours", async () => {
    // Le legacy ne lit qu'un `countryCode` scalaire : `"FR,RE"` lui renvoie 0 document (mesuré
    // sur l'API réelle). Une liste ne peut donc être qu'un éventail de requêtes.
    const entity = fakeEntity();
    entity.getZoneShape.mockImplementation(({ countryCode }: { countryCode: string }) =>
      Promise.resolve([
        { id: `${countryCode}-1`, name: countryCode, geoShape: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
      ] as ZoneShapeItem[]),
    );

    const fc = await fetchGeoShapes(entity, {
      id: "regions",
      source: "zones",
      filters: { countryCode: ["FR", "RE", "MQ"], level: "3" },
    });

    expect(entity.getZoneShape.mock.calls.map(([p]) => p.countryCode)).toEqual(["FR", "RE", "MQ"]);
    expect(entity.getZoneShape.mock.calls.every(([p]) => p.level === "3")).toBe(true);
    expect(fc.features.map((f) => f.properties?.name)).toEqual(["FR", "RE", "MQ"]);
  });

  it("un pays SEUL, en liste ou en scalaire, ne déclenche qu'un appel — pas de régression", async () => {
    const entity = fakeEntity();
    await fetchGeoShapes(entity, { id: "z", source: "zones", filters: { countryCode: ["RE"], level: "4" } });
    expect(entity.getZoneShape).toHaveBeenCalledTimes(1);
    expect(entity.getZoneShape).toHaveBeenCalledWith({ countryCode: "RE", level: "4" });
  });

  it("le multi-pays vaut aussi pour zoniris (countryCode y est un filtre identifiant)", async () => {
    const entity = fakeEntity();
    await fetchGeoShapes(entity, {
      id: "iris",
      source: "zoniris",
      filters: { countryCode: ["RE", "MQ"], level: "6" },
    });
    expect(entity.getZoniris.mock.calls.map(([p]) => p.countryCode)).toEqual(["RE", "MQ"]);
    expect(entity.getZoniris.mock.calls.every(([p]) => p.level === "6")).toBe(true);
  });

  it("dédoublonne quand deux pays renvoient le MÊME document", async () => {
    const entity = fakeEntity();
    const partage = { id: "commun", name: "Partagé", geoShape: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } };
    entity.getZoneShape.mockResolvedValue([partage] as ZoneShapeItem[]);
    const fc = await fetchGeoShapes(entity, { id: "z", source: "zones", filters: { countryCode: ["FR", "RE"], level: "3" } });
    expect(fc.features).toHaveLength(1);
  });

  it("encaisse le `null` de getZoneShape (level qui ne résout aucune branche)", async () => {
    const entity = fakeEntity();
    entity.getZoneShape.mockResolvedValue(null);
    const fc = await fetchGeoShapes(entity, { id: "z", source: "zones", filters: { countryCode: "RE", level: "4" } });
    expect(fc).toEqual({ type: "FeatureCollection", features: [] });
  });
});

/** Ray casting — sert de JUGE au test : le libellé doit tomber dans le contour, pas à côté. */
function contains(ring: [number, number][], [x, y]: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

describe("polygonLabelPoint", () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];

  // Croissant : un « C » ouvert à droite. Son centroïde tombe DANS l'échancrure, donc DEHORS —
  // c'est la forme des cirques (Mafate) et des communes littorales qui enveloppent une baie.
  const crescent: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 3],
    [3, 3],
    [3, 7],
    [10, 7],
    [10, 10],
    [0, 10],
    [0, 0],
  ];

  it("place le libellé au large du bord sur une forme convexe", () => {
    const point = polygonLabelPoint({ type: "Polygon", coordinates: [square] })!;
    expect(contains(square, point)).toBe(true);
    expect(point[0]).toBeGreaterThan(3);
    expect(point[0]).toBeLessThan(7);
    expect(point[1]).toBeGreaterThan(3);
    expect(point[1]).toBeLessThan(7);
  });

  it("reste À L'INTÉRIEUR d'une forme concave, là où le centroïde sortirait", () => {
    const point = polygonLabelPoint({ type: "Polygon", coordinates: [crescent] })!;
    expect(contains(crescent, point)).toBe(true);
    // Le centroïde, lui, tombe dans l'échancrure : c'est précisément ce qu'on évite.
    expect(contains(crescent, [6.5, 5])).toBe(false);
  });

  it("libelle la pièce la plus vaste d'un MultiPolygon", () => {
    const islet: [number, number][] = [
      [100, 100],
      [101, 100],
      [101, 101],
      [100, 101],
      [100, 100],
    ];
    const point = polygonLabelPoint({ type: "MultiPolygon", coordinates: [[islet], [square]] })!;
    expect(contains(square, point)).toBe(true);
  });

  it("rend null pour une géométrie non surfacique", () => {
    expect(polygonLabelPoint({ type: "LineString", coordinates: square })).toBeNull();
  });

  it("polygonArea classe les contours par surface", () => {
    expect(polygonArea({ type: "Polygon", coordinates: [square] })).toBe(100);
    expect(polygonArea({ type: "LineString", coordinates: square })).toBe(0);
  });
});
