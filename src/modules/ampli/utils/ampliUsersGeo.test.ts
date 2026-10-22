import { describe, expect, it } from "vitest";
import {
  buildContributorsMapModel,
  collectMissingCities,
  contributorId,
  toContributorMapEntity,
} from "./ampliUsersGeo";
import type { UserWithContributions } from "../helpers/summary";

/**
 * Conversion des contributeurs ampli en entités carto.
 * Couvre les gardes qui font échouer la carte EN SILENCE : id non hexadécimal,
 * Null Island, coordonnées en string, auteur non résolu, doublons.
 */

const HEX = "629b22a92e3a194b495cc871";
const HEX2 = "6927ea1d4bad3956d17b1e4f";

/** Entrée de contributeur telle que la produit `getSummaryData`. */
function makeEntry(serverData: Record<string, unknown> | null, count = 1): UserWithContributions {
  return {
    user: serverData === null ? null : ({ serverData } as unknown as UserWithContributions["user"]),
    contributionCount: count,
  };
}

const GEOJSON = { type: "Point", coordinates: [46.938404, -21.8291434] };

/** Lecture typée du serverData d'une entité produite. */
function sd(entity: unknown) {
  return (entity as { serverData: Record<string, unknown> }).serverData;
}

describe("contributorId", () => {
  it("préfère `id`, l'hexadécimal nu posé par la normalisation SDK", () => {
    expect(contributorId({ id: HEX, _id: { _str: HEX2 } })).toBe(HEX);
  });

  it("déplie `_id._str` quand `id` est absent", () => {
    expect(contributorId({ _id: { _str: HEX } })).toBe(HEX);
  });

  it("déplie `_id.$id` (forme EJSON brute)", () => {
    expect(contributorId({ _id: { $id: HEX } })).toBe(HEX);
  });

  it("accepte un `_id` déjà en string hexadécimale", () => {
    expect(contributorId({ _id: HEX })).toBe(HEX);
  });

  it("REJETTE la forme `ObjectID(\"…\")` de String(_id)", () => {
    // C'est exactement ce que rend `ObjectID.toString()` — la retenir comme id
    // produirait une clé React et une cible de synchro qui ne matchent rien.
    expect(contributorId({ id: `ObjectID("${HEX}")` })).toBeUndefined();
  });

  it("rend undefined sans identifiant exploitable", () => {
    expect(contributorId({})).toBeUndefined();
    expect(contributorId(undefined)).toBeUndefined();
    expect(contributorId({ id: "", _id: null })).toBeUndefined();
  });
});

describe("toContributorMapEntity", () => {
  it("convertit un contributeur géolocalisé", () => {
    const entity = toContributorMapEntity(
      makeEntry({ id: HEX, name: "Schumann", geoPosition: GEOJSON }),
    );
    expect(entity).not.toBeNull();
    expect(sd(entity).geoPosition).toEqual({ type: "Point", coordinates: [46.938404, -21.8291434] });
    expect(sd(entity).collection).toBe("citoyens");
    expect(sd(entity).name).toBe("Schumann");
  });

  it("pose l'id à la RACINE et dans serverData", () => {
    const entity = toContributorMapEntity(makeEntry({ id: HEX, geoPosition: GEOJSON }));
    // `getEntryId` lit la racine en premier : les deux doivent concorder.
    expect((entity as unknown as { id: string }).id).toBe(HEX);
    expect(sd(entity).id).toBe(HEX);
  });

  it("coerce les coordonnées en STRING (forme fréquente de l'API)", () => {
    const entity = toContributorMapEntity(
      makeEntry({ id: HEX, geo: { latitude: "-21.8291434", longitude: "46.938404" } }),
    );
    expect(sd(entity).geoPosition).toEqual({ type: "Point", coordinates: [46.938404, -21.8291434] });
  });

  it("ignore un geoPosition À MOITIÉ vide et retombe sur geo", () => {
    // `Number("")` vaut 0 : sans rejet en amont, le point [0, -21.83] serait
    // « valide » et différent de [0,0], donc retenu — le contributeur
    // atterrirait dans le golfe de Guinée au lieu de sa vraie position.
    const entity = toContributorMapEntity(
      makeEntry({
        id: HEX,
        geoPosition: { coordinates: ["", "-21.8291434"] },
        geo: { latitude: "-21.8", longitude: "46.9" },
      }),
    );
    expect(sd(entity).geoPosition).toEqual({ type: "Point", coordinates: [46.9, -21.8] });
  });

  it("rejette un geo à moitié vide plutôt que de le placer sur le méridien 0", () => {
    const entity = toContributorMapEntity(
      makeEntry({ id: HEX, geo: { latitude: "-21.8", longitude: null } }),
    );
    expect(entity).toBeNull();
  });

  it("préfère geoPosition à geo quand les deux sont là", () => {
    const entity = toContributorMapEntity(
      makeEntry({ id: HEX, geoPosition: GEOJSON, geo: { latitude: "10", longitude: "20" } }),
    );
    expect(sd(entity).geoPosition).toEqual({ type: "Point", coordinates: [46.938404, -21.8291434] });
  });

  it("se replie sur geo quand geoPosition est inexploitable", () => {
    const entity = toContributorMapEntity(
      makeEntry({
        id: HEX,
        geoPosition: { coordinates: ["", ""] },
        geo: { latitude: "-21.8", longitude: "46.9" },
      }),
    );
    expect(sd(entity).geoPosition).toEqual({ type: "Point", coordinates: [46.9, -21.8] });
  });

  describe("cas qui écartent le contributeur de la carte", () => {
    it("auteur non résolu (string brute)", () => {
      const entry = { user: HEX, contributionCount: 1 } as UserWithContributions;
      expect(toContributorMapEntity(entry)).toBeNull();
    });

    it("auteur null", () => {
      expect(toContributorMapEntity(makeEntry(null))).toBeNull();
    });

    it("sans coordonnées — le cas NOMINAL (adresse sans géocodage)", () => {
      const entity = toContributorMapEntity(
        makeEntry({ id: HEX, name: "Francki", address: { addressLocality: "Fianarantsoa" } }),
      );
      expect(entity).toBeNull();
    });

    it("Null Island : [0, 0] est rejeté", () => {
      // `Number("")` vaut 0 : un champ géo présent mais vide placerait le
      // contributeur au large du Ghana.
      expect(toContributorMapEntity(makeEntry({ id: HEX, geoPosition: { coordinates: [0, 0] } }))).toBeNull();
      expect(
        toContributorMapEntity(makeEntry({ id: HEX, geo: { latitude: "", longitude: "" } })),
      ).toBeNull();
    });

    it("coordonnées hors bornes", () => {
      expect(
        toContributorMapEntity(makeEntry({ id: HEX, geoPosition: { coordinates: [200, 100] } })),
      ).toBeNull();
    });

    it("sans id exploitable (clé React et synchro impossibles)", () => {
      expect(toContributorMapEntity(makeEntry({ name: "Sans id", geoPosition: GEOJSON }))).toBeNull();
    });
  });

  describe("projection des champs de la popup", () => {
    it("OMET `name` vide au lieu de le poser à undefined", () => {
      // `useItem` fusionne ses défauts par spread : `name: undefined` écraserait
      // le repli « Nom inconnu » et rendrait un titre VIDE.
      const entity = toContributorMapEntity(makeEntry({ id: HEX, name: "  ", geoPosition: GEOJSON }));
      expect("name" in sd(entity)).toBe(false);
    });

    it("relaie les DEUX champs d'image (marqueur et popup les lisent en ordre inverse)", () => {
      const entity = toContributorMapEntity(
        makeEntry({
          id: HEX,
          geoPosition: GEOJSON,
          profilThumbImageUrl: "/thumb.png",
          profilMediumImageUrl: "/medium.png",
        }),
      );
      expect(sd(entity).profilThumbImageUrl).toBe("/thumb.png");
      expect(sd(entity).profilMediumImageUrl).toBe("/medium.png");
    });

    it("n'invente pas de champ image quand il n'y en a pas", () => {
      const entity = toContributorMapEntity(makeEntry({ id: HEX, geoPosition: GEOJSON }));
      expect("profilMediumImageUrl" in sd(entity)).toBe(false);
      expect("profilThumbImageUrl" in sd(entity)).toBe(false);
    });

    it("remonte la description en shortDescription (seul champ lu par la popup)", () => {
      const entity = toContributorMapEntity(
        makeEntry({ id: HEX, description: "Bio", geoPosition: GEOJSON }),
      );
      expect(sd(entity).shortDescription).toBe("Bio");
    });

    it("place le libellé de contributions dans shortDescription", () => {
      const entity = toContributorMapEntity(
        makeEntry({ id: HEX, geoPosition: GEOJSON }, 3),
        { formatContributions: (count: number) => `${count} contributions` },
      );
      expect(sd(entity).shortDescription).toBe("3 contributions");
    });

    it("le libellé de contributions prime sur la bio", () => {
      const entity = toContributorMapEntity(
        makeEntry({ id: HEX, description: "Bio", geoPosition: GEOJSON }, 2),
        { formatContributions: (count: number) => `${count} contributions` },
      );
      expect(sd(entity).shortDescription).toBe("2 contributions");
    });

    it("relaie l'adresse et le slug quand ils existent", () => {
      const address = { streetAddress: "Ezaka", postalCode: "", addressLocality: "Ambalavao" };
      const entity = toContributorMapEntity(
        makeEntry({ id: HEX, slug: "schumann", address, geoPosition: GEOJSON }),
      );
      expect(sd(entity).address).toEqual(address);
      expect(sd(entity).slug).toBe("schumann");
      expect((entity as unknown as { slug: string }).slug).toBe("schumann");
    });
  });
});

describe("buildContributorsMapModel", () => {
  it("compte les localisés ET le total (un non localisé n'est pas une erreur)", () => {
    const model = buildContributorsMapModel([
      makeEntry({ id: HEX, name: "Schumann", geoPosition: GEOJSON }),
      makeEntry({ id: HEX2, name: "Francki", address: { addressLocality: "Fianarantsoa" } }),
    ]);
    expect(model.entities).toHaveLength(1);
    expect(model.located).toBe(1);
    expect(model.total).toBe(2);
  });

  it("déduplique les ids (deux marqueurs empilés = clés React dupliquées)", () => {
    const model = buildContributorsMapModel([
      makeEntry({ id: HEX, geoPosition: GEOJSON }),
      makeEntry({ id: HEX, geoPosition: GEOJSON }),
    ]);
    expect(model.entities).toHaveLength(1);
    expect(model.located).toBe(1);
    // `total` reste le nombre de contributeurs remontés par l'agrégation.
    expect(model.total).toBe(2);
  });

  it("préserve l'ordre de la liste", () => {
    const model = buildContributorsMapModel([
      makeEntry({ id: HEX2, geoPosition: GEOJSON }),
      makeEntry({ id: HEX, geoPosition: GEOJSON }),
    ]);
    expect(model.entities.map((e) => (e as unknown as { id: string }).id)).toEqual([HEX2, HEX]);
  });

  it("relaie le formateur de contributions à chaque entité", () => {
    const model = buildContributorsMapModel(
      [makeEntry({ id: HEX, geoPosition: GEOJSON }, 5)],
      { formatContributions: (count: number) => `${count} contributions` },
    );
    const first = model.entities[0] as unknown as { serverData: Record<string, unknown> };
    expect(first.serverData.shortDescription).toBe("5 contributions");
  });

  it("rend un modèle vide sans contributeur", () => {
    expect(buildContributorsMapModel([])).toEqual({ entities: [], located: 0, total: 0 });
  });
});

describe("repli par COMMUNE (contributeur sans coordonnées propres)", () => {
  // Cas nominal sur Communecter : le profil porte une adresse renseignée mais
  // AUCUN géocodage. L'annuaire l'affiche avec sa ville — l'écarter de la carte
  // donnerait moins de points que de fiches.
  const ADDRESS = {
    addressLocality: "Fianarantsoa",
    addressCountry: "MG",
    localityId: "5b30cbcf40bb4e6b652cc601",
  };

  describe("collectMissingCities", () => {
    it("retient les contributeurs à adresse mais sans coordonnées", () => {
      expect(collectMissingCities([makeEntry({ id: HEX, address: ADDRESS })])).toEqual([
        { localityId: ADDRESS.localityId, name: "Fianarantsoa", countryCode: "MG" },
      ]);
    });

    it("ignore ceux qui ont DÉJÀ des coordonnées", () => {
      const entry = makeEntry({ id: HEX, address: ADDRESS, geoPosition: GEOJSON });
      expect(collectMissingCities([entry])).toEqual([]);
    });

    it("déduplique par commune (une requête par ville, pas par contributeur)", () => {
      const cities = collectMissingCities([
        makeEntry({ id: HEX, address: ADDRESS }),
        makeEntry({ id: HEX2, address: ADDRESS }),
      ]);
      expect(cities).toHaveLength(1);
    });

    it("ignore une adresse incomplète (rien à interroger)", () => {
      expect(collectMissingCities([makeEntry({ id: HEX, address: { addressLocality: "Fianarantsoa" } })])).toEqual([]);
      expect(collectMissingCities([makeEntry({ id: HEX, address: { localityId: "x", addressCountry: "MG" } })])).toEqual([]);
      expect(collectMissingCities([makeEntry({ id: HEX })])).toEqual([]);
    });

    it("ignore un auteur non résolu", () => {
      expect(collectMissingCities([{ user: HEX, contributionCount: 1 }])).toEqual([]);
    });
  });

  describe("application des coordonnées de commune", () => {
    const cityCoords = new Map<string, [number, number]>([[ADDRESS.localityId, [47.085447, -21.45337]]]);

    it("place le contributeur au centre de sa commune", () => {
      const entity = toContributorMapEntity(makeEntry({ id: HEX, address: ADDRESS }), { cityCoords });
      expect(sd(entity).geoPosition).toEqual({ type: "Point", coordinates: [47.085447, -21.45337] });
    });

    it("ne s'applique QUE faute de coordonnées propres", () => {
      const entity = toContributorMapEntity(
        makeEntry({ id: HEX, address: ADDRESS, geoPosition: GEOJSON }),
        { cityCoords },
      );
      expect(sd(entity).geoPosition).toEqual({ type: "Point", coordinates: [46.938404, -21.8291434] });
    });

    it("reste non localisé tant que la commune n'est pas résolue", () => {
      expect(toContributorMapEntity(makeEntry({ id: HEX, address: ADDRESS }), {})).toBeNull();
    });

    it("compte les contributeurs placés par leur commune dans `located`", () => {
      const model = buildContributorsMapModel(
        [
          makeEntry({ id: HEX, address: ADDRESS }),
          makeEntry({ id: HEX2, name: "Schumann", geoPosition: GEOJSON }),
        ],
        { cityCoords },
      );
      expect(model.located).toBe(2);
      expect(model.total).toBe(2);
    });
  });
});
