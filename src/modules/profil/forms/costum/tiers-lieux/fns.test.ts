// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

// Mock useT (et autres hooks i18n) qui sont inutiles ici, pour éviter
// d'avoir à monter un I18nProvider.
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string) => key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({
  useLoadNamespace: () => {},
}));

import {
  buildOpeningHoursPayload,
  buildTiersLieuxPayload as buildTiersLieuxPayloadRaw,
  mapEntityToTiersLieuxValues as mapEntityToTiersLieuxValuesRaw,
  type EntityLike,
  type TiersLieuxFormData,
  type BuildPayloadOptions,
} from "./fns";
import { getDefaultTiersLieuxValues } from "./fns";
import { tiersLieuxDescriptor } from "./descriptor";

// DI : les fns reçoivent désormais le descripteur (résolu au runtime via getDescriptor en prod). Ici on
// l'injecte depuis ./descriptor (dérivation pure de schema.ts) → tests inchangés, fonctions restent pures.
const buildTiersLieuxPayload = (data: TiersLieuxFormData, options?: BuildPayloadOptions) =>
  buildTiersLieuxPayloadRaw(data, tiersLieuxDescriptor, options);
const mapEntityToTiersLieuxValues = (entity: EntityLike) =>
  mapEntityToTiersLieuxValuesRaw(entity, tiersLieuxDescriptor);

/**
 * Tests de tiersLieuxMapping : conversions entity ↔ form pour l'entité
 * "tiers-lieux" du costum FranceTiersLieux.
 *
 * On vérifie surtout l'aller/retour et le mapping des champs typés
 * (openingHours, address, family, managementType, socialLinks).
 */

describe("buildOpeningHoursPayload", () => {
  it("retourne 7 entrées pour 7 jours (avec '' pour les jours fermés)", () => {
    const hours = getDefaultTiersLieuxValues().hours;
    const payload = buildOpeningHoursPayload(hours);
    expect(payload).toHaveLength(7);
  });

  it("défaut = tous les jours FERMÉS (pas de présélection Lun–Ven)", () => {
    // Régression : la factory ne pré-coche plus aucun jour (création opt-in ; édition d'un vide
    // affiche vide via parseOpeningHours qui réutilise ces défauts). cf. tiersLieux.schema.getDefaultTiersLieuxValues.
    const hours = getDefaultTiersLieuxValues().hours;
    expect(Object.values(hours).every((d) => d.enabled === false)).toBe(true);
  });

  it("encode lundi ouvert en {dayOfWeek: 'Mo', hours: [...]}", () => {
    const hours = { ...getDefaultTiersLieuxValues().hours, monday: { enabled: true, start: "08:00", end: "18:00" } };
    const payload = buildOpeningHoursPayload(hours);
    expect(payload[0]).toEqual({
      dayOfWeek: "Mo",
      hours: [{ opens: "08:00", closes: "18:00" }],
    });
  });

  it("encode samedi fermé en '' (défaut)", () => {
    const hours = getDefaultTiersLieuxValues().hours;
    const payload = buildOpeningHoursPayload(hours);
    // Samedi = index 5
    expect(payload[5]).toBe("");
  });

  it("encode tous les jours fermés si enabled=false partout", () => {
    const hours = getDefaultTiersLieuxValues().hours;
    for (const day of Object.keys(hours) as Array<keyof typeof hours>) {
      hours[day].enabled = false;
    }
    const payload = buildOpeningHoursPayload(hours);
    expect(payload.every((entry) => entry === "")).toBe(true);
  });
});

describe("buildTiersLieuxPayload", () => {
  it("inclut name et email (required)", () => {
    const data = { ...getDefaultTiersLieuxValues(), name: "Mon TL", email: "x@y.fr" };
    const payload = buildTiersLieuxPayload(data);
    expect(payload.name).toBe("Mon TL");
    expect(payload.email).toBe("x@y.fr");
  });

  it("omet les champs vides optionnels", () => {
    const data = { ...getDefaultTiersLieuxValues(), name: "TL", email: "x@y.fr" };
    const payload = buildTiersLieuxPayload(data);
    expect(payload).not.toHaveProperty("shortDescription");
    expect(payload).not.toHaveProperty("description");
    expect(payload).not.toHaveProperty("video");
  });

  it("convertit family[] en typePlace string CSV", () => {
    const data = {
      ...getDefaultTiersLieuxValues(),
      name: "TL",
      email: "x@y.fr",
      family: ["coworking", "foodlab"],
    };
    const payload = buildTiersLieuxPayload(data);
    expect(payload.typePlace).toBe("coworking, foodlab");
  });

  it("convertit managementType 'autre' + managementTypeOther en manageModel custom", () => {
    const data = {
      ...getDefaultTiersLieuxValues(),
      name: "TL",
      email: "x@y.fr",
      managementType: "autre",
      managementTypeOther: "Coopérative spéciale",
    };
    const payload = buildTiersLieuxPayload(data);
    expect(payload.manageModel).toBe("Coopérative spéciale");
  });

  it("garde managementType connu tel quel en manageModel", () => {
    const data = {
      ...getDefaultTiersLieuxValues(),
      name: "TL",
      email: "x@y.fr",
      managementType: "association",
    };
    const payload = buildTiersLieuxPayload(data);
    expect(payload.manageModel).toBe("association");
  });

  it("encode openingMonth + openingYear en 'DD/MM/YYYY'", () => {
    const data = {
      ...getDefaultTiersLieuxValues(),
      name: "TL",
      email: "x@y.fr",
      openingMonth: "06",
      openingYear: "2024",
    };
    const payload = buildTiersLieuxPayload(data);
    expect(payload.openingDate).toBe("01/06/2024");
  });

  it("inclut openingHours si au moins un jour ouvert", () => {
    const base = getDefaultTiersLieuxValues();
    const data = { ...base, name: "TL", email: "x@y.fr", hours: { ...base.hours, monday: { enabled: true, start: "08:00", end: "18:00" } } };
    const payload = buildTiersLieuxPayload(data);
    expect(payload.openingHours).toBeDefined();
    expect(Array.isArray(payload.openingHours)).toBe(true);
  });

  it("omet openingHours si tous les jours sont fermés", () => {
    const hours = getDefaultTiersLieuxValues().hours;
    for (const day of Object.keys(hours) as Array<keyof typeof hours>) {
      hours[day].enabled = false;
    }
    const data = {
      ...getDefaultTiersLieuxValues(),
      hours,
      name: "TL",
      email: "x@y.fr",
    };
    const payload = buildTiersLieuxPayload(data);
    expect(payload).not.toHaveProperty("openingHours");
  });

  it("filtre les socialLinks incomplets (platform ou url manquant)", () => {
    const data = {
      ...getDefaultTiersLieuxValues(),
      name: "TL",
      email: "x@y.fr",
      socialLinks: [
        { platform: "twitter", url: "https://twitter.com/x" },
        { platform: "", url: "https://x.com" },
        { platform: "facebook", url: "" },
      ],
    };
    const payload = buildTiersLieuxPayload(data);
    // Format réel legacy : OBJET `{ platform: url }` (dataBinding org `socialNetwork`), pas un array.
    expect(payload.socialNetwork).toEqual({ twitter: "https://twitter.com/x" });
  });

  it("convertit videoUrl en array video[]", () => {
    const data = {
      ...getDefaultTiersLieuxValues(),
      name: "TL",
      email: "x@y.fr",
      videoUrl: "https://youtube.com/watch?v=abc",
    };
    const payload = buildTiersLieuxPayload(data);
    expect(payload.video).toEqual(["https://youtube.com/watch?v=abc"]);
  });

  it("merge les tags costum, MAIS pas type/preferences (stamp) ni le contexte costum (lib me.costum)", () => {
    const data = { ...getDefaultTiersLieuxValues(), name: "TL", email: "x@y.fr" };
    const payload = buildTiersLieuxPayload(data, {
      costum: {
        mainTag: "TiersLieu",
        compagnon: "comp",
      },
    });
    // `type` ("NGO") et `preferences` ne sont PLUS dans ce payload : ce sont des STAMP costum
    // (spec.mutation.inject.extraFields), posés au CREATE par runEntityMutation (testé dans spec.test).
    expect(payload).not.toHaveProperty("type");
    expect(payload).not.toHaveProperty("preferences");
    // `role` et le CHAMP `mainTag` ne sont PLUS dans le payload : posés par les presets costum de la
    // lib (`me.costum(slug)` → {role:"admin", mainTag:"TiersLieux"}). Seul le merge `tags` reste ici.
    expect(payload).not.toHaveProperty("role");
    expect(payload).not.toHaveProperty("mainTag");
    // `compagnon` est une valeur de tag, pas un champ propre du payload :
    // il est mergé dans `tags`, pas posé en `payload.compagnon`.
    expect(payload).not.toHaveProperty("compagnon");
    expect(payload.tags).toEqual(expect.arrayContaining(["TiersLieu", "comp"]));
    // Contexte costum désormais injecté par la lib (`me.costum(slug)` → costumSlug/costumId/costumType
    // + source posé par le backend) — il ne doit PLUS être dans le payload construit côté site-json.
    expect(payload).not.toHaveProperty("costumSlug");
    expect(payload).not.toHaveProperty("costumId");
    expect(payload).not.toHaveProperty("costumType");
    expect(payload).not.toHaveProperty("source");
  });

  it("n'injecte PAS les costum fields si options.costum absent (mode édition)", () => {
    const data = { ...getDefaultTiersLieuxValues(), name: "TL", email: "x@y.fr" };
    const payload = buildTiersLieuxPayload(data);
    expect(payload).not.toHaveProperty("costumSlug");
    expect(payload).not.toHaveProperty("mainTag");
    expect(payload).not.toHaveProperty("source");
  });
});

describe("buildTiersLieuxPayload — mode complete (édition unifiée S6)", () => {
  it("émet les vides en CLEAR typé (édition) là où la création OMET", () => {
    const data = { ...getDefaultTiersLieuxValues(), name: "TL", email: "x@y.fr" };
    const create = buildTiersLieuxPayload(data);
    expect(create).not.toHaveProperty("shortDescription"); // création : omis
    expect(create).not.toHaveProperty("socialNetwork");
    expect(create).not.toHaveProperty("typePlace");

    const edit = buildTiersLieuxPayload(data, { complete: true });
    expect(edit.shortDescription).toBe("");  // édition : clear "" (string)
    expect(edit.socialNetwork).toBe("");      // objet serveur vidé → "" (jamais {})
    expect(edit.typePlace).toBe("");          // groupe vidé → ""
    expect(edit.name).toBe("TL");             // requis émis normalement
  });

  it("complete : émet l'adresse COMPLÈTE quand renseignée (round-trip non destructif)", () => {
    const data = {
      ...getDefaultTiersLieuxValues(), name: "TL", email: "x@y.fr",
      addressCountry: "FR", addressLocality: "Paris", localityId: "c1", postalCode: "75001",
      level1: "11", level1Name: "IDF", codeInsee: "75056",
    };
    const edit = buildTiersLieuxPayload(data, { complete: true }) as { address: Record<string, unknown> };
    // toEqual STRICT (fige la forme canonique unique du builder d'adresse partagé) : exactement ces 8 clés,
    // pas de level2..4/streetAddress (vides → omis), addressLocality/postalCode présents.
    expect(edit.address).toEqual({
      "@type": "PostalAddress",
      addressCountry: "FR", addressLocality: "Paris", localityId: "c1", postalCode: "75001",
      codeInsee: "75056", level1: "11", level1Name: "IDF",
    });
  });

  it("complete : socialLinks (array) + hours (objet) RENSEIGNÉS → socialNetwork objet + openingHours array", () => {
    // Ex-régression double-passe (GenericForm écrivait AVANT buildTiersLieuxPayload) : tl:socialWrite recevait
    // un objet déjà transformé → crash. En passe simple, buildTiersLieuxPayload reçoit la forme FORM (array/objet).
    const base = getDefaultTiersLieuxValues();
    const data = {
      ...base, name: "TL", email: "x@y.fr",
      socialLinks: [{ platform: "twitter", url: "https://t.co/x" }],
      hours: { ...base.hours, monday: { enabled: true, start: "08:00", end: "18:00" } },
    };
    const edit = buildTiersLieuxPayload(data, { complete: true }) as Record<string, unknown>;
    expect(edit.socialNetwork).toEqual({ twitter: "https://t.co/x" });
    expect(Array.isArray(edit.openingHours)).toBe(true);
    expect((edit.openingHours as unknown[])[0]).toEqual({ dayOfWeek: "Mo", hours: [{ opens: "08:00", closes: "18:00" }] });
  });
});

describe("buildTiersLieuxPayload — geo/geoPosition (lié à l'adresse, S6 geo)", () => {
  const withAddr = {
    ...getDefaultTiersLieuxValues(), name: "TL", email: "x@y.fr",
    addressCountry: "FR", addressLocality: "Paris", localityId: "c1", postalCode: "75001",
  };

  it("adresse + geo posé → geo émis (lat/lng STRING pour geoValid, coords number pour geoPositionValid)", () => {
    const data = {
      ...withAddr,
      geo: { "@type": "GeoCoordinates", latitude: 48.85, longitude: 2.35 },
      geoPosition: { type: "Point", coordinates: [2.35, 48.85] },
    };
    const p = buildTiersLieuxPayload(data as never) as Record<string, unknown>;
    expect(p.geo).toEqual({ "@type": "GeoCoordinates", latitude: "48.85", longitude: "2.35" });
    expect(p.geoPosition).toEqual({ type: "Point", coordinates: [2.35, 48.85] });
  });

  it("édition adresse présente mais geo NON posé (no-touch) → geo OMIS (préservé)", () => {
    const p = buildTiersLieuxPayload(withAddr as never, { complete: true }) as Record<string, unknown>;
    expect("geo" in p).toBe(false);
    expect("geoPosition" in p).toBe(false);
  });

  it("adresse effacée (pas de localityId) → geo/geoPosition CLEAR '' (effacés avec l'adresse)", () => {
    const noLoc = { ...getDefaultTiersLieuxValues(), name: "TL", email: "x@y.fr" }; // localityId vide
    const p = buildTiersLieuxPayload(noLoc as never, { complete: true }) as Record<string, unknown>;
    expect(p.geo).toBe("");
    expect(p.geoPosition).toBe("");
  });
});

describe("mapEntityToTiersLieuxValues", () => {
  it("retourne defaults pour entity sans serverData", () => {
    const result = mapEntityToTiersLieuxValues({} as EntityLike);
    expect(result.name).toBe("");
    expect(result.email).toBe("");
    expect(result.family).toEqual([]);
  });

  it("mappe les champs simples depuis serverData", () => {
    const entity: EntityLike = {
      serverData: {
        name: "Tiers-Lieu Test",
        shortDescription: "Court",
        description: "Long desc",
        email: "tl@example.fr",
        telephone: "+33 1 23 45 67 89",
      },
    };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.name).toBe("Tiers-Lieu Test");
    expect(result.shortDescription).toBe("Court");
    expect(result.description).toBe("Long desc");
    expect(result.email).toBe("tl@example.fr");
    expect(result.phone).toBe("+33 1 23 45 67 89");
  });

  it("parse openingDate '01/06/2024' en month+year", () => {
    const entity: EntityLike = {
      serverData: { openingDate: "01/06/2024" },
    };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.openingMonth).toBe("06");
    expect(result.openingYear).toBe("2024");
  });

  it("parse une typePlace string CSV en family[]", () => {
    const entity: EntityLike = {
      serverData: { typePlace: "coworking, foodlab" },
    };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.family).toEqual(["coworking", "foodlab"]);
  });

  it("parse une typePlace array en family[]", () => {
    const entity: EntityLike = {
      serverData: { typePlace: ["coworking", "foodlab"] },
    };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.family).toEqual(["coworking", "foodlab"]);
  });

  it("reconnaît un manageModel connu (managementType='association')", () => {
    const entity: EntityLike = { serverData: { manageModel: "association" } };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.managementType).toBe("association");
    expect(result.managementTypeOther).toBe("");
  });

  it("classe un manageModel inconnu en 'autre' + managementTypeOther", () => {
    const entity: EntityLike = {
      serverData: { manageModel: "Coopérative spéciale" },
    };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.managementType).toBe("autre");
    expect(result.managementTypeOther).toBe("Coopérative spéciale");
  });

  it("parse openingHours array en hours record", () => {
    const entity: EntityLike = {
      serverData: {
        openingHours: [
          { dayOfWeek: "Mo", hours: [{ opens: "09:00", closes: "17:00" }] },
          { dayOfWeek: "Tu", hours: [{ opens: "09:00", closes: "17:00" }] },
        ],
      },
    };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.hours.monday.enabled).toBe(true);
    expect(result.hours.monday.start).toBe("09:00");
    expect(result.hours.monday.end).toBe("17:00");
    expect(result.hours.tuesday.enabled).toBe(true);
    expect(result.hours.wednesday.enabled).toBe(false);
  });

  it("parse address fields depuis serverData.address", () => {
    const entity: EntityLike = {
      serverData: {
        address: {
          addressCountry: "FR",
          addressLocality: "Paris",
          postalCode: "75001",
          streetAddress: "1 rue de Rivoli",
          localityId: "loc_paris",
        },
      },
    };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.addressCountry).toBe("FR");
    expect(result.addressLocality).toBe("Paris");
    expect(result.postalCode).toBe("75001");
    expect(result.streetAddress).toBe("1 rue de Rivoli");
    expect(result.localityId).toBe("loc_paris");
  });

  it("convertit video[0] en videoUrl", () => {
    const entity: EntityLike = {
      serverData: { video: ["https://youtube.com/abc"] },
    };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.videoUrl).toBe("https://youtube.com/abc");
  });

  it("convertit buildingSurfaceArea numérique en string", () => {
    const entity: EntityLike = {
      serverData: { buildingSurfaceArea: 150, siteSurfaceArea: 500 },
    };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.surfaceBuilt).toBe("150");
    expect(result.surfaceOutdoor).toBe("500");
  });

  it("filtre les socialNetwork malformés", () => {
    const entity: EntityLike = {
      serverData: {
        socialNetwork: [
          { platform: "twitter", url: "https://x.com/a" },
          "not an object",
          null,
        ],
      },
    };
    const result = mapEntityToTiersLieuxValues(entity);
    expect(result.socialLinks).toEqual([
      { platform: "twitter", url: "https://x.com/a" },
    ]);
  });
});

describe("adresse SIG complète (level1..4/codeInsee)", () => {
  // Régression : tiersLieuxSchema ne déclarait que 5 champs d'adresse → le zodResolver STRIPAIT
  // level1..4/codeInsee posés par EditLocationTab → perte SIG au save. Fix : 14 champs + tl:addressRead.
  const fullAddress = {
    addressCountry: "FR", addressLocality: "Saint-Pierre", localityId: "loc_974",
    postalCode: "97410", streetAddress: "12 Allée des Aubépines",
    codeInsee: "97416",
    level1: "REU", level1Name: "La Réunion",
    level2: "974", level2Name: "La Réunion",
    level3: "9742", level3Name: "Arrondissement",
    level4: "97416", level4Name: "Saint-Pierre",
  };

  it("READ : seed les 14 champs depuis serverData.address (plus de strip)", () => {
    const result = mapEntityToTiersLieuxValues({ serverData: { address: fullAddress } });
    expect(result.codeInsee).toBe("97416");
    expect(result.level1).toBe("REU");
    expect(result.level1Name).toBe("La Réunion");
    expect(result.level2).toBe("974");
    expect(result.level3Name).toBe("Arrondissement");
    expect(result.level4).toBe("97416");
  });

  it("round-trip : entity → form → payload reconstruit l'address SIG COMPLÈTE", () => {
    const form = mapEntityToTiersLieuxValues({ serverData: { address: fullAddress } });
    const payload = buildTiersLieuxPayload(form) as { address: Record<string, unknown> };
    // toEqual STRICT (address SIG COMPLÈTE figée) : les 15 clés exactes du builder partagé, level2Name/level3Name inclus.
    expect(payload.address).toEqual({
      "@type": "PostalAddress",
      addressCountry: "FR", addressLocality: "Saint-Pierre", localityId: "loc_974",
      postalCode: "97410", streetAddress: "12 Allée des Aubépines",
      codeInsee: "97416",
      level1: "REU", level1Name: "La Réunion",
      level2: "974", level2Name: "La Réunion",
      level3: "9742", level3Name: "Arrondissement",
      level4: "97416", level4Name: "Saint-Pierre",
    });
  });
});

describe("aller-retour entity ↔ form", () => {
  it("entity → form → payload : champs name/email/family préservés", () => {
    const entity: EntityLike = {
      serverData: {
        name: "Mon TL",
        email: "x@y.fr",
        typePlace: "coworking, foodlab",
        manageModel: "association",
        shortDescription: "Court",
      },
    };
    const form = mapEntityToTiersLieuxValues(entity);
    const payload = buildTiersLieuxPayload(form);
    expect(payload.name).toBe("Mon TL");
    expect(payload.email).toBe("x@y.fr");
    expect(payload.typePlace).toBe("coworking, foodlab");
    expect(payload.manageModel).toBe("association");
    expect(payload.shortDescription).toBe("Court");
  });
});
