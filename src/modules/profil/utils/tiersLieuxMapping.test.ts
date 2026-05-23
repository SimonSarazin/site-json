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
  buildTiersLieuxPayload,
  mapEntityToTiersLieuxValues,
  type EntityLike,
} from "./tiersLieuxMapping";
import { getDefaultTiersLieuxValues } from "../components/add/TiersLieuxForm";

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

  it("encode lundi ouvert en {dayOfWeek: 'Mo', hours: [...]}", () => {
    const hours = getDefaultTiersLieuxValues().hours;
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
    const data = { ...getDefaultTiersLieuxValues(), name: "TL", email: "x@y.fr" };
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
    expect(payload.socialNetwork).toEqual([
      { platform: "twitter", url: "https://twitter.com/x" },
    ]);
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

  it("injecte les costum fields si options.costum fourni", () => {
    const data = { ...getDefaultTiersLieuxValues(), name: "TL", email: "x@y.fr" };
    const payload = buildTiersLieuxPayload(data, {
      costum: {
        slug: "franceTierslieux",
        id: "abc123",
        type: "organizations",
        mainTag: "TiersLieu",
        compagnon: "comp",
      },
    });
    expect(payload.type).toBe("NGO");
    expect(payload.role).toBe("admin");
    expect(payload.mainTag).toBe("TiersLieu");
    expect(payload.compagnon).toBe("comp");
    expect(payload.costumSlug).toBe("franceTierslieux");
    expect(payload.costumId).toBe("abc123");
    expect(payload.costumType).toBe("organizations");
    expect(payload.costumEditMode).toBe(false);
    expect(payload.preferences).toEqual({ isOpenData: true, isOpenEdition: true });
  });

  it("n'injecte PAS les costum fields si options.costum absent (mode édition)", () => {
    const data = { ...getDefaultTiersLieuxValues(), name: "TL", email: "x@y.fr" };
    const payload = buildTiersLieuxPayload(data);
    expect(payload).not.toHaveProperty("costumSlug");
    expect(payload).not.toHaveProperty("mainTag");
    expect(payload).not.toHaveProperty("source");
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
