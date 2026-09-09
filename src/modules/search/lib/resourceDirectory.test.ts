import { describe, it, expect } from "vitest";
import {
  allServicePricingPrices,
  buildResourceDirectoryFilters,
  buildServicePricingOverride,
  finderPath,
  meetingRoomRows,
  parseMeetingRooms,
  parseResourceDirectoryItem,
  resolveAnswerArea,
  resolveAnswerDescription,
  resolveAnswerEquipments,
  resolveAnswerParent,
  resolveAnswerParentEmail,
  resolveAnswerServices,
  resolveAnswerType,
  resolveResourceName,
  type ResourceTypeConf,
} from "./resourceDirectory";
import { extractServicePricingAnswers } from "../helpers/servicePricingAnswers";

const FINDER = "miem3epsztzcm9dgim";
const EQUIP = "mieg8j24m89gm99t5mi";
const NAME = "mieg4k7yxrito5j9e6";
const AREA = "mieg4k7zslc8awrql2";

const COWORKING: ResourceTypeConf = {
  id: "coworking",
  kind: "coworking",
  formId: "6925e2b05dd63b02ca70d6d9",
  stepPrefix: "navigatorDesTierslieux25112025_209_0",
};
const MEETING: ResourceTypeConf = {
  id: "meeting-room",
  kind: "meeting",
  formId: "6925869ad76aaf6c5a2b2f8a",
  stepPrefix: "navigatorDesTierslieux25112025_1436_0",
  descriptionSuffix: "miolbscdcrucb5a8uuq",
};
const ACCOMMODATION: ResourceTypeConf = {
  id: "accommodation",
  kind: "accommodation",
  formId: "6925ee8ac537f8056114aec7",
  stepPrefix: "navigatorDesTierslieux25112025_2059_0",
  descriptionSuffix: "miq88plgleoln5tmc7b",
  servicesSuffix: "miq86g5vaw1kavrapkb",
};
const TYPES = [COWORKING, MEETING, ACCOMMODATION];
const SUFFIXES = { finder: FINDER, name: NAME, equipments: EQUIP, area: AREA };

// Réponse coworking réelle abrégée (probe `getsressourcetl` sur communecter-dev).
// Le champ NOM (`…mieg4k7yxrito5j9e6`) est absent → repli attendu.
const COWORKING_ANSWER = {
  _id: { $id: "6933501b90e38a364423f8e6" },
  collection: "answers",
  links: {
    organizations: { "6018faf8690864c45f8b4b41": { name: "Coroutine (La)", type: "organizations" } },
  },
  answers: {
    navigatorDesTierslieux25112025_209_0: {
      findernavigatorDesTierslieux25112025_209_0miem3epsztzcm9dgim: {
        "6018faf8690864c45f8b4b41": { id: "6018faf8690864c45f8b4b41", name: "Coroutine (La)", type: "organizations" },
      },
      navigatorDesTierslieux25112025_209_0mieg8j24m89gm99t5mi: ["Wifi", "Imprimante", "Accessibilité PMR"],
      navigatorDesTierslieux25112025_209_0mieg4k7z9gv729cs53: "20",
      navigatorDesTierslieux25112025_209_0mieg4k7zslc8awrql2: "100",
      navigatorDesTierslieux25112025_209_0minag948nw1ltatx78o: "5",
      navigatorDesTierslieux25112025_209_0minagtkflgfepmrq32l: "9",
      navigatorDesTierslieux25112025_209_0minah6jdpwjpzymuxm: "16",
    },
  },
} as unknown as Record<string, unknown>;

// Réponse « hébergement » : services proposés + tarifs lit/chambre.
const ACCOMMODATION_ANSWER = {
  _id: { $id: "acc1" },
  collection: "answers",
  form: ACCOMMODATION.formId,
  answers: {
    navigatorDesTierslieux25112025_2059_0: {
      findernavigatorDesTierslieux25112025_2059_0miem3epsztzcm9dgim: {
        org7: { id: "org7", name: "La Coopé", type: "organizations" },
      },
      navigatorDesTierslieux25112025_2059_0mieg4k7z9gv729cs53: "5",
      navigatorDesTierslieux25112025_2059_0miq86g5vaw1kavrapkb: ["Petit-déjeuner", "Linge de lit fourni"],
      navigatorDesTierslieux25112025_2059_0minaceqtibwcyy3khtm: "18",
      navigatorDesTierslieux25112025_2059_0miq84do7c678u3c8xuq: "45",
    },
  },
} as unknown as Record<string, unknown>;

// Réponse « salle de réunion » avec la commonTable `roomPath` (ligne 0 = en-têtes).
// Colonnes : [name, area, minPers, maxPers, hourly, halfDay, fullDay, solidaire, images[]].
const MEETING_ANSWER = {
  _id: { $id: "meet1" },
  collection: "answers",
  form: MEETING.formId,
  answers: {
    navigatorDesTierslieux25112025_1436_0: {
      findernavigatorDesTierslieux25112025_1436_0miem3epsztzcm9dgim: {
        org9: { id: "org9", name: "La Plume à Loup", type: "organizations" },
      },
      navigatorDesTierslieux25112025_1436_0miolbscdcrucb5a8uuq: "Un espace lumineux et polyvalent.",
      navigatorDesTierslieux25112025_1436_0miokvr9ezvu0064fk: [
        ["Nom", "Surface", "min", "max", "h", "1/2j", "j", "Solidaire", "photos"],
        ["Grande salle", "45", "4", "20", "30", "", "", "Oui", ["/upload/communecter/answers/meet1/album/a.jpg", "/upload/communecter/answers/meet1/album/b.jpg"]],
        ["Petite salle", "", "2", "8", "20", "", "", "Non", []],
      ],
    },
  },
} as unknown as Record<string, unknown>;

// Réponse « salle de réunion » APRÈS éclatement serveur (`Navigator::getRessourceTL`) :
// 1 salle = 1 réponse — `roomName`/`roomIndex` posés, tableau réduit à [labels, 1 salle].
const MEETING_ROOM_ANSWER = {
  _id: { $id: "meet1" },
  collection: "answers",
  form: MEETING.formId,
  roomIndex: 2,
  roomName: "Petite salle",
  parentAnswerId: "meet1",
  answers: {
    navigatorDesTierslieux25112025_1436_0: {
      findernavigatorDesTierslieux25112025_1436_0miem3epsztzcm9dgim: {
        org9: { id: "org9", name: "La Plume à Loup", type: "organizations" },
      },
      navigatorDesTierslieux25112025_1436_0miolbscdcrucb5a8uuq: "Un espace lumineux et polyvalent.",
      navigatorDesTierslieux25112025_1436_0miokvr9ezvu0064fk: [
        ["Nom", "Surface", "min", "max", "h", "1/2j", "j", "Solidaire", "photos"],
        ["Petite salle", "18", "2", "8", "20", "", "", "Non", ["/upload/communecter/answers/meet1/album/p.jpg"]],
      ],
    },
  },
} as unknown as Record<string, unknown>;

describe("finderPath", () => {
  it("compose `answers.<step>.finder<step><suffixe>`", () => {
    expect(finderPath(COWORKING, FINDER)).toBe(
      "answers.navigatorDesTierslieux25112025_209_0.findernavigatorDesTierslieux25112025_209_0miem3epsztzcm9dgim",
    );
  });
});

describe("buildResourceDirectoryFilters", () => {
  it("form.$in + $or en forme MAP `chemin → $exists` (pas un tableau — 500 legacy)", () => {
    const f = buildResourceDirectoryFilters(TYPES, FINDER);
    expect(f.form).toEqual({ $in: [COWORKING.formId, MEETING.formId, ACCOMMODATION.formId] });
    expect(Array.isArray(f.$or)).toBe(false);
    expect(f.$or).toEqual({
      [finderPath(COWORKING, FINDER)]: { $exists: true },
      [finderPath(MEETING, FINDER)]: { $exists: true },
      [finderPath(ACCOMMODATION, FINDER)]: { $exists: true },
    });
  });

  it("liste vide → objet vide (pas de `form` ni `$or` morts)", () => {
    expect(buildResourceDirectoryFilters([], FINDER)).toEqual({});
  });
});

describe("resolveAnswerType", () => {
  it("par le champ `form` quand présent", () => {
    expect(resolveAnswerType({ form: MEETING.formId }, TYPES)).toBe(MEETING);
  });
  it("sinon par l'étape présente dans `answers`", () => {
    expect(resolveAnswerType(COWORKING_ANSWER, TYPES)).toBe(COWORKING);
  });
  it("aucune correspondance → undefined", () => {
    expect(resolveAnswerType({ answers: { autreEtape: {} } }, TYPES)).toBeUndefined();
    expect(resolveAnswerType(undefined, TYPES)).toBeUndefined();
  });
});

describe("resolveAnswerParent", () => {
  it("depuis l'input finder (1ʳᵉ organisation)", () => {
    expect(resolveAnswerParent(COWORKING_ANSWER, TYPES, FINDER)).toEqual({
      id: "6018faf8690864c45f8b4b41",
      name: "Coroutine (La)",
      type: "organizations",
    });
  });
  it("repli sur links.organizations si pas de finder", () => {
    const noFinder = {
      answers: { [COWORKING.stepPrefix]: {} },
      links: { organizations: { org1: { name: "Repli", type: "organizations" } } },
    };
    expect(resolveAnswerParent(noFinder, TYPES, FINDER)).toEqual({
      id: "org1",
      name: "Repli",
      type: "organizations",
    });
  });
  it("rien à résoudre → null", () => {
    expect(resolveAnswerParent({ answers: { [COWORKING.stepPrefix]: {} } }, TYPES, FINDER)).toBeNull();
  });
});

describe("resolveAnswerParentEmail", () => {
  it("prend `serverData.email` de premier niveau", () => {
    expect(resolveAnswerParentEmail({ email: "contact@laruche.fr" })).toBe("contact@laruche.fr");
  });
  it("repli sur la 1ʳᵉ valeur de `parentEmails`", () => {
    expect(
      resolveAnswerParentEmail({ parentEmails: { org1: "", org2: "hello@tl.org" } }),
    ).toBe("hello@tl.org");
  });
  it("rien → undefined", () => {
    expect(resolveAnswerParentEmail({})).toBeUndefined();
    expect(resolveAnswerParentEmail(undefined)).toBeUndefined();
  });
});

describe("resolveAnswerEquipments", () => {
  it("liste d'équipements par suffixe stable", () => {
    expect(resolveAnswerEquipments(COWORKING_ANSWER, COWORKING, EQUIP)).toEqual([
      "Wifi",
      "Imprimante",
      "Accessibilité PMR",
    ]);
  });
  it("sans suffixe configuré → vide", () => {
    expect(resolveAnswerEquipments(COWORKING_ANSWER, COWORKING, undefined)).toEqual([]);
  });
});

describe("meetingRoomRows", () => {
  it("renvoie les lignes du tableau (en-têtes incluses)", () => {
    expect(meetingRoomRows(MEETING_ANSWER, MEETING)).toHaveLength(3);
  });
  it("hors meeting → []", () => {
    expect(meetingRoomRows(COWORKING_ANSWER, COWORKING)).toEqual([]);
  });
});

describe("parseMeetingRooms", () => {
  it("mappe chaque ligne (hors en-têtes) : nom, surface, capacité, tarifs, solidaire, images", () => {
    const rooms = parseMeetingRooms(MEETING_ANSWER, MEETING);
    expect(rooms).toHaveLength(2);
    expect(rooms[0]).toEqual({
      name: "Grande salle",
      area: "45",
      minPers: 4,
      maxPers: 20,
      hourly: 30,
      halfDay: undefined,
      fullDay: undefined,
      solidaire: "Oui",
      images: ["/upload/communecter/answers/meet1/album/a.jpg", "/upload/communecter/answers/meet1/album/b.jpg"],
    });
    expect(rooms[1].images).toEqual([]);
    expect(rooms[1].area).toBeUndefined();
  });
  it("hors meeting → []", () => {
    expect(parseMeetingRooms(COWORKING_ANSWER, COWORKING)).toEqual([]);
  });
});

describe("resolveAnswerDescription", () => {
  it("lit le champ « À propos » via `descriptionSuffix` du type", () => {
    expect(resolveAnswerDescription(MEETING_ANSWER, MEETING)).toBe("Un espace lumineux et polyvalent.");
  });
  it("sans `descriptionSuffix` → undefined", () => {
    expect(resolveAnswerDescription(COWORKING_ANSWER, COWORKING)).toBeUndefined();
  });
});

describe("resolveAnswerArea", () => {
  it("lit la surface via le suffixe partagé `area`", () => {
    expect(resolveAnswerArea(COWORKING_ANSWER, COWORKING, AREA)).toBe("100");
  });
  it("sans suffixe → undefined", () => {
    expect(resolveAnswerArea(COWORKING_ANSWER, COWORKING, undefined)).toBeUndefined();
  });
});

describe("resolveAnswerServices", () => {
  it("lit « Services proposés » via `servicesSuffix` (hébergement)", () => {
    expect(resolveAnswerServices(ACCOMMODATION_ANSWER, ACCOMMODATION)).toEqual([
      "Petit-déjeuner",
      "Linge de lit fourni",
    ]);
  });
  it("type sans `servicesSuffix` → []", () => {
    expect(resolveAnswerServices(COWORKING_ANSWER, COWORKING)).toEqual([]);
  });
});

describe("allServicePricingPrices", () => {
  it("coworking : tous les tarifs non nuls (h / ½j / j)", () => {
    const agg = extractServicePricingAnswers(
      { [COWORKING.formId]: [{ serverData: COWORKING_ANSWER } as never] },
      buildServicePricingOverride(TYPES),
    );
    expect(allServicePricingPrices(agg, "coworking")).toEqual([
      { unit: "hour", price: 5 },
      { unit: "halfDay", price: 9 },
      { unit: "fullDay", price: 16 },
    ]);
  });
  it("hébergement : lit + chambre", () => {
    const agg = extractServicePricingAnswers(
      { [ACCOMMODATION.formId]: [{ serverData: ACCOMMODATION_ANSWER } as never] },
      buildServicePricingOverride(TYPES),
    );
    expect(allServicePricingPrices(agg, "accommodation")).toEqual([
      { unit: "bed", price: 18 },
      { unit: "room", price: 45 },
    ]);
  });
});

describe("resolveResourceName — cf. tlCardRessourcePanelHtml", () => {
  it("champ dédié quand renseigné", () => {
    const withName = {
      answers: { [COWORKING.stepPrefix]: { [`${COWORKING.stepPrefix}${NAME}`]: "Le Nid" } },
    };
    expect(resolveResourceName(withName, COWORKING, NAME)).toEqual({ name: "Le Nid" });
  });
  it("coworking sans nom → repli i18n `nameCoworking`", () => {
    expect(resolveResourceName(COWORKING_ANSWER, COWORKING, NAME)).toEqual({
      nameFallback: { key: "resourceDirectory.nameCoworking" },
    });
  });
  it("accommodation sans nom → repli `nameAccommodation`", () => {
    expect(resolveResourceName({ answers: { [ACCOMMODATION.stepPrefix]: {} } }, ACCOMMODATION, NAME)).toEqual({
      nameFallback: { key: "resourceDirectory.nameAccommodation" },
    });
  });
  it("meeting → `serverData.roomName` (posé par l'éclatement serveur)", () => {
    expect(resolveResourceName(MEETING_ROOM_ANSWER, MEETING, NAME)).toEqual({ name: "Petite salle" });
  });
  it("meeting sans roomName → le nom de la salle (colonne 0 du tableau)", () => {
    const oneRoom = {
      answers: {
        [MEETING.stepPrefix]: {
          [`${MEETING.stepPrefix}miokvr9ezvu0064fk`]: [["Nom"], ["Salle bleue", "", "2", "10"]],
        },
      },
    };
    expect(resolveResourceName(oneRoom, MEETING, NAME)).toEqual({ name: "Salle bleue" });
  });
});

describe("buildServicePricingOverride", () => {
  it("mappe chaque type sur sa catégorie service-pricing", () => {
    const o = buildServicePricingOverride(TYPES);
    expect(o.coworking?.id).toBe(COWORKING.formId);
    expect(o.meeting?.id).toBe(MEETING.formId);
    expect(o.accommodation?.id).toBe(ACCOMMODATION.formId);
    expect(o.coworking?.place).toContain(COWORKING.stepPrefix);
  });
});

describe("parseResourceDirectoryItem", () => {
  it("coworking : type + parent + équipements + capacité + tarif + repli de nom", () => {
    const model = parseResourceDirectoryItem(COWORKING_ANSWER, {
      resourceTypes: TYPES,
      finderSuffix: FINDER,
      fieldSuffixes: SUFFIXES,
    });
    expect(model.type).toBe(COWORKING);
    expect(model.parent?.name).toBe("Coroutine (La)");
    expect(model.equipments).toHaveLength(3);
    expect(model.name).toBeUndefined();
    expect(model.nameFallback).toEqual({ key: "resourceDirectory.nameCoworking" });
    expect(model.description).toBeUndefined();
    expect(model.rooms).toEqual([]);
    expect(model.area).toBe("100");
    expect(model.extraServices).toEqual([]);
    // 20 postes → capacité "coworking" ; tarif horaire 5 → service "hour".
    expect(model.stats).toEqual([{ kind: "coworking", count: 20 }]);
    expect(model.services).toEqual([{ kind: "coworking", unit: "hour", price: 5 }]);
    // TOUS les tarifs, pas seulement le premier.
    expect(model.prices).toEqual([
      { unit: "hour", price: 5 },
      { unit: "halfDay", price: 9 },
      { unit: "fullDay", price: 16 },
    ]);
    expect(model.roomIndex).toBeUndefined();
  });

  it("hébergement : services proposés + tous les tarifs (lit / chambre)", () => {
    const model = parseResourceDirectoryItem(ACCOMMODATION_ANSWER, {
      resourceTypes: TYPES,
      finderSuffix: FINDER,
      fieldSuffixes: SUFFIXES,
    });
    expect(model.type).toBe(ACCOMMODATION);
    expect(model.extraServices).toEqual(["Petit-déjeuner", "Linge de lit fourni"]);
    expect(model.prices).toEqual([
      { unit: "bed", price: 18 },
      { unit: "room", price: 45 },
    ]);
  });

  it("meeting éclaté (1 salle = 1 réponse) : nom = roomName, photos de la salle, roomIndex", () => {
    const model = parseResourceDirectoryItem(MEETING_ROOM_ANSWER, {
      resourceTypes: TYPES,
      finderSuffix: FINDER,
      fieldSuffixes: SUFFIXES,
    });
    expect(model.type).toBe(MEETING);
    expect(model.name).toBe("Petite salle");
    expect(model.roomIndex).toBe(2);
    expect(model.rooms).toHaveLength(1);
    // photos = colonne 8 de la salle (priment sur les documents).
    expect(model.photos).toEqual(["/upload/communecter/answers/meet1/album/p.jpg"]);
    // capacité + tarif de LA salle : 2-8 pers., 20 €/h.
    expect(model.stats).toEqual([{ kind: "meeting", count: 0, range: { min: 2, max: 8 } }]);
    expect(model.services).toEqual([{ kind: "meeting", unit: "hour", price: 20 }]);
    expect(model.description).toBe("Un espace lumineux et polyvalent.");
  });

  it("réponse vide → modèle inerte, pas d'exception", () => {
    const model = parseResourceDirectoryItem(undefined, {
      resourceTypes: TYPES,
      finderSuffix: FINDER,
    });
    expect(model).toEqual({
      type: undefined,
      name: undefined,
      nameFallback: undefined,
      description: undefined,
      area: undefined,
      parent: null,
      equipments: [],
      extraServices: [],
      photos: [],
      bookingUrl: undefined,
      rooms: [],
      roomIndex: undefined,
      stats: [],
      services: [],
      prices: [],
    });
  });
});
