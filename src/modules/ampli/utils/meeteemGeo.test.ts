import { describe, expect, it } from "vitest";
import { buildMeeteemMapModel, isAnswerId, meeteemCardId, toMeeteemMapEntity } from "./meeteemGeo";
import type { MeeteemCard } from "../types";

/**
 * Adaptation réponse CoForm → entité cartographiable.
 *
 * Les formes d'adresse testées viennent de la donnée RÉELLE renvoyée par
 * `/survey/coform/answerslist` : objet plat `{address, geo, geoPosition}` avec
 * des coordonnées en STRING, ou champ absent quand la réponse n'a pas
 * d'adresse (cas majoritaire sur un coform sans champ adresse obligatoire).
 */

const REAL_ADDRESS = {
  address: {
    "@type": "PostalAddress",
    addressCountry: "MG",
    addressLocality: "Fianarantsoa",
    postalCode: "301",
    localityId: "5b30cbcf40bb4e6b652cc601",
  },
  geo: { "@type": "GeoCoordinates", latitude: "-21.4564440", longitude: "47.0851490" },
  geoPosition: { type: "Point", float: "true", coordinates: ["47.085149", "-21.456444"] },
};

function makeCard(overrides: Partial<{ id: string; address: unknown; name: string; tags: string[] }> = {}): MeeteemCard {
  return {
    answer: { serverData: { id: overrides.id ?? "answer-1" } },
    data: {
      name: overrides.name ?? "Ma réponse",
      description: "Une description",
      tags: overrides.tags,
      ...("address" in overrides ? { address: overrides.address } : {}),
    },
  };
}

describe("meeteemCardId", () => {
  it("prend l'id de la réponse quand il existe", () => {
    expect(meeteemCardId(makeCard({ id: "abc" }), 3)).toBe("abc");
  });

  it("retombe sur l'index quand la réponse n'a pas d'id", () => {
    const card = makeCard();
    card.answer.serverData.id = undefined;
    expect(meeteemCardId(card, 3)).toBe("meeteem-3");
  });
});

describe("isAnswerId", () => {
  it("accepte un ObjectId de réponse", () => {
    expect(isAnswerId("6927ea1d4bad3956d17b1e4f")).toBe(true);
  });

  // Ouvrir le détail sur ce repli lancerait la requête sur un id fantôme et
  // afficherait une modale vide.
  it("rejette le repli indexé de meeteemCardId", () => {
    expect(isAnswerId("meeteem-3")).toBe(false);
  });

  it("rejette vide, null et undefined", () => {
    expect(isAnswerId("")).toBe(false);
    expect(isAnswerId(null)).toBe(false);
    expect(isAnswerId(undefined)).toBe(false);
  });

  it("rejette une chaîne de longueur incorrecte ou non hexadécimale", () => {
    expect(isAnswerId("6927ea1d4bad3956d17b1e")).toBe(false);
    expect(isAnswerId("6927ea1d4bad3956d17b1e4z")).toBe(false);
  });

  it("est cohérent avec meeteemCardId sur une carte réelle", () => {
    expect(isAnswerId(meeteemCardId(makeCard({ id: "6927ea1d4bad3956d17b1e4f" }), 0))).toBe(true);
    const sansId = makeCard();
    sansId.answer.serverData.id = undefined;
    expect(isAnswerId(meeteemCardId(sansId, 2))).toBe(false);
  });
});

describe("toMeeteemMapEntity", () => {
  it("convertit les coordonnées STRING du backend en nombres GeoJSON [lng, lat]", () => {
    const entity = toMeeteemMapEntity(makeCard({ address: REAL_ADDRESS }), 0);
    const serverData = entity?.serverData as Record<string, { coordinates?: unknown }>;
    expect(serverData.geoPosition.coordinates).toEqual([47.085149, -21.456444]);
  });

  it("expose l'id à la racine ET dans serverData (getEntryId lit la racine)", () => {
    const entity = toMeeteemMapEntity(makeCard({ id: "answer-42", address: REAL_ADDRESS }), 0);
    expect((entity as unknown as { id: string }).id).toBe("answer-42");
    expect((entity?.serverData as { id: string }).id).toBe("answer-42");
  });

  it("projette les champs lus par la popup (nom, description, tags, adresse)", () => {
    const entity = toMeeteemMapEntity(
      makeCard({ address: REAL_ADDRESS, name: "Café associatif", tags: ["culture"] }),
      0,
    );
    const sd = entity?.serverData as Record<string, unknown>;
    expect(sd.name).toBe("Café associatif");
    expect(sd.shortDescription).toBe("Une description");
    expect(sd.tags).toEqual(["culture"]);
    expect((sd.address as { addressLocality: string }).addressLocality).toBe("Fianarantsoa");
  });

  it("retombe sur geo{latitude,longitude} quand geoPosition manque", () => {
    const entity = toMeeteemMapEntity(
      makeCard({ address: { address: REAL_ADDRESS.address, geo: REAL_ADDRESS.geo } }),
      0,
    );
    const sd = entity?.serverData as Record<string, { coordinates?: unknown }>;
    expect(sd.geoPosition.coordinates).toEqual([47.085149, -21.456444]);
  });

  it("ignore un geoPosition À MOITIÉ vide et retombe sur geo", () => {
    // `Number("")` vaut 0 : sans rejet en amont, le point produit serait
    // « valide » et différent de [0,0], donc retenu — il court-circuiterait le
    // repli `geo` pourtant correct.
    const entity = toMeeteemMapEntity(
      makeCard({
        address: {
          address: REAL_ADDRESS.address,
          geo: REAL_ADDRESS.geo,
          geoPosition: { type: "Point", coordinates: ["", "-21.456444"] },
        },
      }),
      0,
    );
    const sd = entity?.serverData as Record<string, { coordinates?: unknown }>;
    expect(sd.geoPosition.coordinates).toEqual([47.085149, -21.456444]);
  });

  it("retient l'adresse principale (center) quand la réponse en porte plusieurs", () => {
    const other = {
      address: { addressLocality: "Antananarivo", localityId: "x" },
      geo: { latitude: "-18.8792", longitude: "47.5079" },
      geoPosition: { type: "Point", coordinates: [47.5079, -18.8792] },
    };
    const entity = toMeeteemMapEntity(
      makeCard({
        address: {
          formLocality: [other, { ...REAL_ADDRESS, center: true }],
          ...REAL_ADDRESS,
        },
      }),
      0,
    );
    const sd = entity?.serverData as Record<string, { addressLocality?: string }>;
    expect(sd.address.addressLocality).toBe("Fianarantsoa");
  });

  it("renvoie null sans champ adresse", () => {
    expect(toMeeteemMapEntity(makeCard(), 0)).toBeNull();
  });

  it("renvoie null sur une adresse SANS coordonnées (pas de marqueur à Null Island)", () => {
    // `parseStoredToEntries` reconstruit ici une entrée avec geoPosition [0,0]
    // et geo vide : sans garde, la réponse atterrirait au large du Ghana.
    const card = makeCard({ address: { address: { addressLocality: "Fianarantsoa", localityId: "x" } } });
    expect(toMeeteemMapEntity(card, 0)).toBeNull();
  });

  it("renvoie null sur une ancienne valeur en texte libre (non géolocalisable)", () => {
    expect(toMeeteemMapEntity(makeCard({ address: "Fianarantsoa" }), 0)).toBeNull();
  });

  it("renvoie null sur des coordonnées hors bornes", () => {
    const card = makeCard({
      address: { ...REAL_ADDRESS, geo: { latitude: "999", longitude: "999" }, geoPosition: { type: "Point", coordinates: ["999", "999"] } },
    });
    expect(toMeeteemMapEntity(card, 0)).toBeNull();
  });
});

describe("buildMeeteemMapModel", () => {
  it("ne garde que les réponses géolocalisées, et signale lesquelles", () => {
    const cards = [
      makeCard({ id: "geo-1", address: REAL_ADDRESS }),
      makeCard({ id: "sans-adresse" }),
      makeCard({ id: "geo-2", address: REAL_ADDRESS }),
    ];

    const { entities, locatedIds } = buildMeeteemMapModel(cards);

    expect(entities).toHaveLength(2);
    expect([...locatedIds]).toEqual(["geo-1", "geo-2"]);
    expect(locatedIds.has("sans-adresse")).toBe(false);
  });

  it("préserve l'ordre de la liste (ids alignés liste ↔ carte)", () => {
    const cards = [
      makeCard({ id: "a", address: REAL_ADDRESS }),
      makeCard({ id: "b", address: REAL_ADDRESS }),
    ];
    const ids = buildMeeteemMapModel(cards).entities.map((e) => (e as unknown as { id: string }).id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("renvoie un modèle vide sur une liste vide", () => {
    const { entities, locatedIds } = buildMeeteemMapModel([]);
    expect(entities).toEqual([]);
    expect(locatedIds.size).toBe(0);
  });
});
