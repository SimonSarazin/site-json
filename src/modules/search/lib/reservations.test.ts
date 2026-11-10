import { describe, it, expect } from "vitest";
import {
  RESERVATION_COLORS,
  reservationColor,
  toMinutes,
  formatSlotTime,
  parseReservationAnswer,
  groupReservationsByUser,
  groupReservationsByResource,
  buildWeeklyGrid,
  reservationConflicts,
  slotsOverlap,
  periodsOverlap,
  isIsoDay,
  buildBookingGrid,
  minutesToLabel,
  slotPeriod,
  reservationsInPeriod,
  ownSlotPeriod,
  distinctPeriods,
  mergeBookingRows,
  rawSlotAt,
  resourceGroupsInPeriod,
  type Reservation,
  type ReservationSlot,
  type CandidateSlot,
  type ReservationCandidate,
} from "./reservations";

/* ── Fixtures ────────────────────────────────────────────────────────────── */

const STEP = "step2026_0";
const FIELDS = {
  finder: "fFinder",
  user: "fUser",
  userOrga: "fOrga",
  activity: "fActivity",
  slots: "fSlots",
  periodStart: "fStart",
  periodEnd: "fEnd",
  bookingType: "fType",
};
const CONF = { step: STEP, fields: FIELDS };

/** Construit le `serverData` d'une answer avec les champs d'étape donnés. */
function answerData(
  stepFields: Record<string, unknown>,
  root: Record<string, unknown> = {},
): Record<string, unknown> {
  const step: Record<string, unknown> = {};
  for (const [suffix, value] of Object.entries(stepFields)) {
    // Les DEUX finders (ressource et organisation usagère) sont préfixés `finder<step>`
    // — convention vérifiée en base ; les champs simples gardent la clé brute.
    const key =
      suffix === FIELDS.finder || suffix === FIELDS.userOrga
        ? `finder${STEP}${suffix}`
        : `${STEP}${suffix}`;
    step[key] = value;
  }
  return { id: "a1", answers: { [STEP]: step }, ...root };
}

function slot(day: string, sh: string, sm: string, eh: string, em: string) {
  return { day, startHour: sh, startMinute: sm, endHour: eh, endMinute: em };
}

function reservation(partial: Partial<Reservation>): Reservation {
  return {
    id: "r",
    resources: [],
    resourceIds: [],
    user: "",
    slots: [],
    ...partial,
  };
}

/* ── toMinutes / formatSlotTime ──────────────────────────────────────────── */

describe("toMinutes", () => {
  it("convertit heure+minute en minutes depuis minuit", () => {
    expect(toMinutes("17", "00")).toBe(1020);
    expect(toMinutes("9", "5")).toBe(545);
  });

  it("traite une minute absente ou invalide comme 0", () => {
    expect(toMinutes("9", undefined)).toBe(540);
    expect(toMinutes("9", "xx")).toBe(540);
  });

  it("renvoie null si l'heure est inexploitable", () => {
    expect(toMinutes("abc", "00")).toBeNull();
    expect(toMinutes(undefined, "00")).toBeNull();
  });
});

describe("formatSlotTime", () => {
  it("zéro-padde heures et minutes", () => {
    expect(formatSlotTime("17", "00")).toBe("17:00");
    expect(formatSlotTime("9", "5")).toBe("09:05");
  });

  it("traite une minute absente comme 00", () => {
    expect(formatSlotTime("9", undefined)).toBe("09:00");
  });

  it("replie sur la valeur brute si l'heure est inexploitable", () => {
    expect(formatSlotTime("matin", "00")).toBe("matin");
    expect(formatSlotTime(undefined, "00")).toBe("");
  });
});

/* ── parseReservationAnswer ──────────────────────────────────────────────── */

describe("parseReservationAnswer", () => {
  it("parse une answer nominale complète", () => {
    const sd = answerData({
      [FIELDS.finder]: { poi1: { id: "poi1", name: "Gymnase", type: "poi" } },
      [FIELDS.user]: "BADMINTON DE LA SALINE",
      [FIELDS.activity]: "BADMINTON",
      [FIELDS.slots]: [
        slot("thursday", "17", "00", "19", "00"),
        slot("monday", "17", "00", "19", "00"),
      ],
      [FIELDS.periodStart]: "2026-01-01",
      [FIELDS.periodEnd]: "2026-08-13",
      [FIELDS.bookingType]: "ENTRAINEMENT",
    });

    const r = parseReservationAnswer(sd, CONF);
    expect(r).not.toBeNull();
    expect(r!.id).toBe("a1");
    expect(r!.resourceIds).toEqual(["poi1"]);
    expect(r!.user).toBe("BADMINTON DE LA SALINE");
    expect(r!.activity).toBe("BADMINTON");
    expect(r!.bookingType).toBe("ENTRAINEMENT");
    expect(r!.periodStart).toBe("2026-01-01");
    expect(r!.periodEnd).toBe("2026-08-13");
    expect(r!.slots).toEqual([
      { day: "thursday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140, index: 0 },
      { day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140, index: 1 },
    ]);
  });

  it("renvoie null si l'étape est absente", () => {
    expect(parseReservationAnswer({ id: "a1" }, CONF)).toBeNull();
    expect(parseReservationAnswer({ id: "a1", answers: {} }, CONF)).toBeNull();
  });

  it("renvoie slots vides si le champ créneaux est absent ou non-array", () => {
    const sd = answerData({ [FIELDS.user]: "CLUB" });
    expect(parseReservationAnswer(sd, CONF)!.slots).toEqual([]);
    const sd2 = answerData({ [FIELDS.slots]: "pas un tableau" });
    expect(parseReservationAnswer(sd2, CONF)!.slots).toEqual([]);
  });

  it("ignore un slot au jour inconnu ou à l'heure invalide, conserve les autres", () => {
    const sd = answerData({
      [FIELDS.slots]: [
        slot("Lundi", "17", "00", "19", "00"), // jour non canonique → ignoré
        slot("monday", "xx", "00", "19", "00"), // heure invalide → ignoré
        slot("friday", "08", "30", "10", "00"),
      ],
    });
    const r = parseReservationAnswer(sd, CONF)!;
    expect(r.slots).toHaveLength(1);
    expect(r.slots[0].day).toBe("friday");
    // Position dans le tableau BRUT, pas dans `slots` : c'est elle que vise la modification d'horaire.
    expect(r.slots[0].index).toBe(2);
  });

  it("normalise un usager vide/espaces en chaîne vide", () => {
    const sd = answerData({ [FIELDS.user]: "   " });
    expect(parseReservationAnswer(sd, CONF)!.user).toBe("");
  });

  it("lit l'organisation usagère : le nom du finder prime, l'identifiant est porté", () => {
    const sd = answerData({
      [FIELDS.user]: "BASKET CLUB  SAINT-PAULOIS",
      [FIELDS.userOrga]: {
        org1: { id: "org1", name: "BASKET CLUB SAINT PAULOIS", type: "organizations" },
      },
    });
    const r = parseReservationAnswer(sd, CONF)!;
    expect(r.user).toBe("BASKET CLUB SAINT PAULOIS");
    expect(r.userId).toBe("org1");
  });

  it("retombe sur le texte historique quand le finder organisation est absent", () => {
    const r = parseReservationAnswer(answerData({ [FIELDS.user]: "JS SALINE" }), CONF)!;
    expect(r.user).toBe("JS SALINE");
    expect(r.userId).toBeUndefined();
  });

  it("ignore un finder organisation vide ou mal formé sans perdre le texte", () => {
    for (const bidon of [{}, [], "org1", null]) {
      const sd = answerData({ [FIELDS.user]: "JS SALINE", [FIELDS.userOrga]: bidon });
      const r = parseReservationAnswer(sd, CONF)!;
      expect(r.user).toBe("JS SALINE");
      expect(r.userId).toBeUndefined();
    }
  });

  it("laisse les champs optionnels undefined quand absents", () => {
    const r = parseReservationAnswer(answerData({}), CONF)!;
    expect(r.activity).toBeUndefined();
    expect(r.bookingType).toBeUndefined();
    expect(r.periodStart).toBeUndefined();
    expect(r.periodEnd).toBeUndefined();
  });

  it("lit le type d'usager de l'import, valeurs accumulées gardées telles quelles, seulement si fields.userType est configuré", () => {
    const sd = answerData({ fUserType: "Etablissement scolaire | Association" });

    const conf = { step: STEP, fields: { ...FIELDS, userType: "fUserType" } };
    expect(parseReservationAnswer(sd, conf)!.userType).toBe("Etablissement scolaire | Association");
    expect(parseReservationAnswer(sd, CONF)!.userType).toBeUndefined();
  });

  it("ne filtre pas une answer selon un statut de validation", () => {
    // Le rôle « validé » n'existe pas dans le mapping : une answer avec un
    // champ Valide="Non" en base est parsée normalement (décision actée).
    const sd = answerData({ [`${STEP}champValide`]: "Non", [FIELDS.user]: "CLUB" });
    expect(parseReservationAnswer(sd, CONF)).not.toBeNull();
  });

  it("replie l'id sur _id.$id puis sur chaîne vide", () => {
    const viaOid = answerData({}, { id: undefined, _id: { $id: "oid1" } });
    delete viaOid.id;
    expect(parseReservationAnswer(viaOid, CONF)!.id).toBe("oid1");

    const sans = answerData({});
    delete sans.id;
    expect(parseReservationAnswer(sans, CONF)!.id).toBe("");
  });

  it("rawSlotAt rend le créneau BRUT d'un index, tel que stocké, ou rien", () => {
    const brut = { ...slot("Monday", "07", "35", "15", "10"), duree: 27300 };
    const sd = answerData({ [FIELDS.slots]: [slot("friday", "08", "00", "09", "00"), brut] });
    expect(rawSlotAt(sd, CONF, 1)).toBe(brut);
    expect(rawSlotAt(sd, CONF, 2)).toBeUndefined();
    expect(rawSlotAt(answerData({ [FIELDS.slots]: "pas un tableau" }), CONF, 0)).toBeUndefined();
    expect(rawSlotAt(undefined, CONF, 0)).toBeUndefined();
  });

  it("liste plusieurs ressources si le finder en pointe plusieurs", () => {
    const sd = answerData({
      [FIELDS.finder]: { poi1: { id: "poi1" }, poi2: { id: "poi2" } },
    });
    expect(parseReservationAnswer(sd, CONF)!.resourceIds).toEqual(["poi1", "poi2"]);
  });

  it("conserve le NOM porté par le finder de la ressource", () => {
    // C'est ce nom qui permet à la fiche d'une organisation de lister ses
    // équipements sans relire un POI par ligne. Un finder sans nom (réponse
    // ancienne) laisse l'entrée sans libellé, jamais d'id inventé.
    const sd = answerData({
      [FIELDS.finder]: {
        poi1: { id: "poi1", name: "Dojo", type: "poi" },
        poi2: { id: "poi2" },
      },
    });
    expect(parseReservationAnswer(sd, CONF)!.resources).toEqual([
      { id: "poi1", name: "Dojo" },
      { id: "poi2", name: undefined },
    ]);
  });
});

/* ── groupReservationsByResource ─────────────────────────────────────────── */

describe("groupReservationsByResource", () => {
  const avec = (id: string, ressources: Array<{ id: string; name?: string }>, jours = 1) =>
    reservation({
      id,
      resources: ressources,
      resourceIds: ressources.map((r) => r.id),
      slots: Array.from({ length: jours }, () => ({
        day: "monday" as const,
        start: "17:00",
        end: "19:00",
        startMinutes: 1020,
        endMinutes: 1140,
      })),
    });

  it("groupe par équipement, compte les créneaux et trie par nom", () => {
    const groupes = groupReservationsByResource([
      avec("r1", [{ id: "poi2", name: "Salle de danse" }]),
      avec("r2", [{ id: "poi1", name: "Dojo" }], 2),
      avec("r3", [{ id: "poi1", name: "Dojo" }]),
    ]);
    expect(groupes.map((g) => g.resourceId)).toEqual(["poi1", "poi2"]);
    expect(groupes[0].reservations.map((r) => r.id)).toEqual(["r2", "r3"]);
    expect(groupes[0].slotCount).toBe(3);
    expect(groupes[1].slotCount).toBe(1);
  });

  it("compte une réservation multi-ressources dans CHAQUE équipement", () => {
    // Le même créneau occupe bien les deux équipements : l'omettre d'un des
    // deux ferait disparaître une occupation réelle de la fiche du club.
    const groupes = groupReservationsByResource([
      avec("r1", [
        { id: "poi1", name: "Dojo" },
        { id: "poi2", name: "Salle de danse" },
      ]),
    ]);
    expect(groupes).toHaveLength(2);
    expect(groupes.every((g) => g.slotCount === 1)).toBe(true);
  });

  it("retient le premier nom connu quand une réponse n'en porte pas", () => {
    const groupes = groupReservationsByResource([
      avec("r1", [{ id: "poi1" }]),
      avec("r2", [{ id: "poi1", name: "Dojo" }]),
    ]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0].resourceName).toBe("Dojo");
  });
});

/* ── groupReservationsByUser ─────────────────────────────────────────────── */

describe("groupReservationsByUser", () => {
  it("réunit dans UN SEUL groupe le même club saisi en texte et choisi dans la liste", () => {
    // Le cas exact de la reprise : « BASKET CLUB  SAINT-PAULOIS » (double espace, trait d'union)
    // saisi à la main, et « BASKET CLUB SAINT PAULOIS » venu du finder. Deux groupes signifieraient
    // deux couleurs dans la grille pour un seul club.
    const list = [
      reservation({ id: "r1", user: "BASKET CLUB  SAINT-PAULOIS" }),
      reservation({ id: "r2", user: "BASKET CLUB SAINT PAULOIS", userId: "org1" }),
    ];
    const groups = groupReservationsByUser(list);
    expect(groups).toHaveLength(1);
    expect(groups[0].reservations.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(groups[0].userId).toBe("org1");
  });

  it("sépare deux clubs d'identifiants différents, même si leurs noms se ressemblent", () => {
    const groups = groupReservationsByUser([
      reservation({ id: "r1", user: "MONTAGNE REUNION", userId: "org1" }),
      reservation({ id: "r2", user: "Montagne Réunion", userId: "org2" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("regroupe par usager, déduplique les activités et somme les créneaux", () => {
    const list = [
      reservation({ id: "r1", user: "CLUB A", activity: "BADMINTON", slots: [{ day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 }] }),
      reservation({ id: "r2", user: "CLUB A", activity: "BADMINTON", slots: [{ day: "friday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 }] }),
    ];
    const groups = groupReservationsByUser(list);
    expect(groups).toHaveLength(1);
    expect(groups[0].activities).toEqual(["BADMINTON"]);
    expect(groups[0].slotCount).toBe(2);
    expect(groups[0].reservations).toHaveLength(2);
  });

  it("trie insensible à la casse et aux accents", () => {
    const groups = groupReservationsByUser([
      reservation({ id: "r1", user: "école B" }),
      reservation({ id: "r2", user: "Association A" }),
      reservation({ id: "r3", user: "ECOLE A" }),
    ]);
    expect(groups.map((g) => g.user)).toEqual(["Association A", "ECOLE A", "école B"]);
  });

  it("attribue un colorIndex stable quel que soit l'ordre d'entrée", () => {
    const a = reservation({ id: "r1", user: "Alpha" });
    const b = reservation({ id: "r2", user: "Beta" });
    const idx = (groups: ReturnType<typeof groupReservationsByUser>) =>
      Object.fromEntries(groups.map((g) => [g.user, g.colorIndex]));
    expect(idx(groupReservationsByUser([a, b]))).toEqual(idx(groupReservationsByUser([b, a])));
  });

  it("regroupe à part l'usager non renseigné", () => {
    const groups = groupReservationsByUser([
      reservation({ id: "r1", user: "" }),
      reservation({ id: "r2", user: "CLUB" }),
    ]);
    expect(groups.map((g) => g.user)).toContain("");
    expect(groups).toHaveLength(2);
  });
});

/* ── buildWeeklyGrid ─────────────────────────────────────────────────────── */

describe("buildWeeklyGrid", () => {
  it("renvoie toujours 7 jours Lun→Dim, jours vides inclus", () => {
    const grid = buildWeeklyGrid([]);
    expect(grid.map((d) => d.dayKey)).toEqual([
      "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    ]);
    expect(grid.every((d) => d.blocks.length === 0)).toBe(true);
  });

  it("trie les blocs par heure de début puis fin puis usager", () => {
    const groups = groupReservationsByUser([
      reservation({
        id: "r1",
        user: "Zeta",
        slots: [{ day: "monday", start: "09:00", end: "11:00", startMinutes: 540, endMinutes: 660 }],
      }),
      reservation({
        id: "r2",
        user: "Alpha",
        slots: [
          { day: "monday", start: "09:00", end: "10:00", startMinutes: 540, endMinutes: 600 },
          // Non jointif avec 09:00 : deux créneaux jointifs d'un même club seraient fusionnés.
          { day: "monday", start: "08:00", end: "08:45", startMinutes: 480, endMinutes: 525 },
        ],
      }),
    ]);
    const monday = buildWeeklyGrid(groups)[0];
    expect(monday.blocks.map((b) => `${b.start}-${b.end} ${b.user}`)).toEqual([
      "08:00-08:45 Alpha",
      "09:00-10:00 Alpha",
      "09:00-11:00 Zeta",
    ]);
  });

  it("fusionne les créneaux jointifs d'un même club, même activité, même période", () => {
    const groups = groupReservationsByUser([
      reservation({
        id: "r1",
        user: "Collège",
        activity: "EPS",
        slots: [
          { day: "tuesday", start: "07:30", end: "09:30", startMinutes: 450, endMinutes: 570 },
          { day: "tuesday", start: "09:30", end: "11:30", startMinutes: 570, endMinutes: 690 },
          { day: "tuesday", start: "13:30", end: "15:30", startMinutes: 810, endMinutes: 930 },
        ],
      }),
      // Un autre club intercalé ne coupe pas la chaîne du premier.
      reservation({
        id: "r2",
        user: "Club",
        activity: "EPS",
        slots: [{ day: "tuesday", start: "08:00", end: "09:30", startMinutes: 480, endMinutes: 570 }],
      }),
    ]);
    const tuesday = buildWeeklyGrid(groups)[1];
    expect(tuesday.blocks.map((b) => `${b.start}-${b.end} ${b.user}`)).toEqual([
      "07:30-11:30 Collège",
      "08:00-09:30 Club",
      "13:30-15:30 Collège",
    ]);
    const fusionne = tuesday.blocks[0];
    expect(fusionne.parts?.map((p) => `${p.start}-${p.end}`)).toEqual(["07:30-09:30", "09:30-11:30"]);
    expect(tuesday.blocks[1].parts).toBeUndefined();
  });

  it("ne fusionne pas deux créneaux jointifs d'activités ou de périodes différentes", () => {
    const groups = groupReservationsByUser([
      reservation({
        id: "eps",
        user: "Collège",
        activity: "EPS",
        slots: [{ day: "monday", start: "08:00", end: "09:00", startMinutes: 480, endMinutes: 540 }],
      }),
      reservation({
        id: "natation",
        user: "Collège",
        activity: "NATATION",
        slots: [{ day: "monday", start: "09:00", end: "10:00", startMinutes: 540, endMinutes: 600 }],
      }),
      reservation({
        id: "t2",
        user: "Collège",
        activity: "EPS",
        periodStart: "2026-11-09",
        slots: [{ day: "monday", start: "09:00", end: "10:00", startMinutes: 540, endMinutes: 600 }],
      }),
    ]);
    expect(buildWeeklyGrid(groups)[0].blocks).toHaveLength(3);
  });

  it("éclate une réservation multi-jours en un bloc par slot, colorIndex hérité", () => {
    const groups = groupReservationsByUser([
      reservation({
        id: "r1",
        user: "CLUB",
        activity: "BADMINTON",
        slots: [
          { day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 },
          { day: "thursday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 },
        ],
      }),
    ]);
    const grid = buildWeeklyGrid(groups);
    const monday = grid.find((d) => d.dayKey === "monday")!;
    const thursday = grid.find((d) => d.dayKey === "thursday")!;
    expect(monday.blocks).toHaveLength(1);
    expect(thursday.blocks).toHaveLength(1);
    expect(monday.blocks[0].colorIndex).toBe(groups[0].colorIndex);
    // Clés uniques par slot.
    expect(monday.blocks[0].key).not.toBe(thursday.blocks[0].key);
  });
});

/* ── reservationColor ────────────────────────────────────────────────────── */

describe("reservationColor", () => {
  it("mappe les premiers indices sur les tokens chart-1..5 puis cycle", () => {
    expect(reservationColor(0)).toBe("var(--chart-1)");
    expect(reservationColor(4)).toBe("var(--chart-5)");
    expect(reservationColor(5)).toBe("var(--chart-1)");
    expect(RESERVATION_COLORS).toHaveLength(5);
  });
});

/* ── reservationConflicts ────────────────────────────────────────────────── */

/** Réservation existante minimale : un créneau hebdo + une période. */
function existing(
  overrides: Partial<Reservation> & { day?: string; start?: number; end?: number } = {},
): Reservation {
  const { day = "monday", start = 1020, end = 1140, ...rest } = overrides;
  return {
    id: "r1",
    resources: [{ id: "poi1" }],
    resourceIds: ["poi1"],
    user: "CLUB A",
    slots: [
      {
        day: day as Reservation["slots"][number]["day"],
        start: "17:00",
        end: "19:00",
        startMinutes: start,
        endMinutes: end,
      },
    ],
    ...rest,
  } as Reservation;
}

const candidat = (start: number, end: number, period: Partial<ReservationCandidate> = {}) => ({
  slots: [{ day: "monday" as const, startMinutes: start, endMinutes: end }],
  ...period,
});

describe("slotsOverlap", () => {
  const slot = (day: string, s: number, e: number) =>
    ({ day, startMinutes: s, endMinutes: e }) as CandidateSlot;

  it("détecte un chevauchement partiel le même jour", () => {
    expect(slotsOverlap(slot("monday", 1020, 1140), slot("monday", 1080, 1200))).toBe(true);
  });

  it("ne voit aucun conflit entre deux créneaux jointifs (semi-ouvert)", () => {
    // 17h–19h puis 19h–20h30 : ils se suivent, ils ne se chevauchent pas.
    expect(slotsOverlap(slot("monday", 1020, 1140), slot("monday", 1140, 1230))).toBe(false);
  });

  it("ignore un jour différent, même aux mêmes heures", () => {
    expect(slotsOverlap(slot("monday", 1020, 1140), slot("tuesday", 1020, 1140))).toBe(false);
  });

  it("ignore un créneau de durée nulle (donnée dégradée)", () => {
    expect(slotsOverlap(slot("monday", 1020, 1020), slot("monday", 960, 1200))).toBe(false);
    expect(slotsOverlap(slot("monday", 960, 1200), slot("monday", 1020, 1020))).toBe(false);
  });

  it("détecte l'inclusion complète d'un créneau dans l'autre", () => {
    expect(slotsOverlap(slot("monday", 1050, 1080), slot("monday", 1020, 1140))).toBe(true);
  });
});

describe("periodsOverlap", () => {
  it("recouvre quand les intervalles se croisent", () => {
    expect(
      periodsOverlap(
        { periodStart: "2026-01-01", periodEnd: "2026-06-30" },
        { periodStart: "2026-06-01", periodEnd: "2026-12-31" },
      ),
    ).toBe(true);
  });

  it("ne recouvre pas deux saisons disjointes", () => {
    expect(
      periodsOverlap(
        { periodStart: "2026-01-01", periodEnd: "2026-06-30" },
        { periodStart: "2026-09-01", periodEnd: "2026-12-31" },
      ),
    ).toBe(false);
  });

  it("inclut les bornes : deux périodes qui se touchent d'un jour se recouvrent", () => {
    expect(
      periodsOverlap(
        { periodStart: "2026-01-01", periodEnd: "2026-06-30" },
        { periodStart: "2026-06-30", periodEnd: "2026-12-31" },
      ),
    ).toBe(true);
  });

  it("traite une borne absente comme infinie", () => {
    expect(periodsOverlap({}, { periodStart: "2026-09-01", periodEnd: "2026-12-31" })).toBe(true);
    expect(periodsOverlap({ periodEnd: "2026-01-01" }, { periodStart: "2026-09-01" })).toBe(false);
  });

  it("traite une borne malformée comme infinie (faux positif préféré)", () => {
    expect(
      periodsOverlap(
        { periodStart: "pas une date", periodEnd: "2026-01-31" },
        { periodStart: "2026-09-01" },
      ),
    ).toBe(false);
    expect(
      periodsOverlap({ periodStart: "pas une date" }, { periodStart: "2026-09-01" }),
    ).toBe(true);
  });

  it("traite une date impossible comme une borne ouverte, comme le calcul des heures", () => {
    // Lu « 2026-02-30 » > « 2026-01-31 », le début excluait janvier ; borne ouverte, le recouvrement est présumé.
    expect(
      periodsOverlap(
        { periodStart: "2026-02-30", periodEnd: "2026-03-31" },
        { periodStart: "2026-01-01", periodEnd: "2026-01-31" },
      ),
    ).toBe(true);
  });
});

describe("isIsoDay", () => {
  it("n'accepte qu'un jour calendaire réel", () => {
    expect(isIsoDay("2026-10-26")).toBe(true);
    expect(isIsoDay("2028-02-29")).toBe(true);
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("2026-13-01")).toBe(false);
    expect(isIsoDay("2026-1-1")).toBe(false);
    expect(isIsoDay(undefined)).toBe(false);
  });
});

describe("reservationConflicts", () => {
  it("signale une réservation qui chevauche le même créneau et la même période", () => {
    const conflits = reservationConflicts(
      candidat(1080, 1200, { periodStart: "2026-01-01", periodEnd: "2026-12-31" }),
      [existing({ periodStart: "2026-01-01", periodEnd: "2026-12-31" })],
    );
    expect(conflits).toHaveLength(1);
    expect(conflits[0].user).toBe("CLUB A");
  });

  it("n'en signale aucune si les périodes sont disjointes", () => {
    expect(
      reservationConflicts(
        candidat(1080, 1200, { periodStart: "2027-01-01", periodEnd: "2027-06-30" }),
        [existing({ periodStart: "2026-01-01", periodEnd: "2026-12-31" })],
      ),
    ).toEqual([]);
  });

  it("n'en signale aucune sur un créneau jointif", () => {
    expect(reservationConflicts(candidat(1140, 1230), [existing()])).toEqual([]);
  });

  it("n'en signale aucune si le candidat n'a pas de créneau", () => {
    expect(reservationConflicts({ slots: [] }, [existing()])).toEqual([]);
  });

  it("ne remonte qu'une fois une réservation à plusieurs créneaux en conflit", () => {
    const r = existing();
    r.slots.push({ day: "monday", start: "17:30", end: "18:30", startMinutes: 1050, endMinutes: 1110 });
    expect(reservationConflicts(candidat(1020, 1140), [r])).toHaveLength(1);
  });

  it("préserve l'ordre d'entrée et écarte les non-conflits", () => {
    const a = { ...existing(), id: "a", user: "CLUB A" };
    const b = { ...existing({ day: "friday" }), id: "b", user: "CLUB B" };
    const c = { ...existing(), id: "c", user: "CLUB C" };
    expect(reservationConflicts(candidat(1020, 1140), [a, b, c]).map((r) => r.id)).toEqual(["a", "c"]);
  });
});

/* ── buildBookingGrid ────────────────────────────────────────────────────── */

describe("buildBookingGrid", () => {
  /** Grille hebdo à partir d'une seule réservation lundi 17h–19h. */
  const semaine = () =>
    buildWeeklyGrid(
      groupReservationsByUser([
        {
          id: "r1",
          resourceIds: ["poi1"],
          user: "CLUB A",
          slots: [
            { day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 },
          ],
        } as Reservation,
      ]),
    );

  /** Grille hebdo à partir d'une réservation à durée NULLE ou inversée (donnée dégradée). */
  const semaineDegradee = (startMinutes: number, endMinutes: number) =>
    buildWeeklyGrid(
      groupReservationsByUser([
        {
          id: "rz",
          resourceIds: ["poi1"],
          user: "CLUB Z",
          slots: [
            { day: "monday", start: "09:00", end: "05:00", startMinutes, endMinutes },
          ],
        } as Reservation,
      ]),
    );

  it("un créneau à durée nulle ou inversée occupe la case de son heure de début", () => {
    // Format legacy 12 h dont `parseSlot` ignore l'AmPm : « 09 AM → 05 PM » ressort en 540 → 300.
    // Par le seul test d'intersection, ce bloc ne recouvrait AUCUNE rangée : la case 09:00–10:00
    // était rendue LIBRE et réservable alors que l'équipement est occupé.
    const rows = buildBookingGrid(semaineDegradee(540, 300), { startHour: 8, endHour: 22, slotMinutes: 60 });
    const lundi = (h: number) =>
      rows.find((r) => r.startMinutes === h * 60)!.cells.find((c) => c.dayKey === "monday")!;
    expect(lundi(9).blocks).toHaveLength(1);
    expect(lundi(10).blocks).toHaveLength(0);
    // Durée nulle : même règle.
    const nul = buildBookingGrid(semaineDegradee(600, 600), { startHour: 8, endHour: 22, slotMinutes: 60 });
    const dixHeures = nul.find((r) => r.startMinutes === 600)!.cells.find((c) => c.dayKey === "monday")!;
    expect(dixHeures.blocks).toHaveLength(1);
  });

  it("l'élargissement des bornes est plafonné à la journée", () => {
    // `parseSlot` ne borne ni les heures ni les minutes : un `endHour: "30"` importé de travers
    // faisait descendre la grille jusqu'à 30:00, avec des libellés « 29:00 – 30:00 ».
    const rows = buildBookingGrid(
      buildWeeklyGrid(
        groupReservationsByUser([
          {
            id: "rh",
            resourceIds: ["poi1"],
            user: "CLUB H",
            slots: [{ day: "monday", start: "28:00", end: "30:00", startMinutes: 1680, endMinutes: 1800 }],
          } as Reservation,
        ]),
      ),
      { startHour: 8, endHour: 22, slotMinutes: 60 },
    );
    expect(rows[rows.length - 1].endMinutes).toBeLessThanOrEqual(24 * 60);
    expect(rows.every((r) => !r.label.includes("25:00") && !r.label.includes("30:00"))).toBe(true);
  });

  it("découpe l'amplitude configurée en rangées régulières, 7 cases chacune", () => {
    const rows = buildBookingGrid(semaine(), { startHour: 8, endHour: 22, slotMinutes: 60 });
    expect(rows).toHaveLength(14);
    expect(rows[0].label).toBe("08:00 – 09:00");
    expect(rows[13].label).toBe("21:00 – 22:00");
    expect(rows[0].cells).toHaveLength(7);
    expect(rows[0].cells.map((c) => c.dayKey)).toEqual([
      "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    ]);
  });

  it("marque occupées TOUTES les rangées recouvertes par un créneau", () => {
    const rows = buildBookingGrid(semaine(), { startHour: 8, endHour: 22, slotMinutes: 60 });
    const lundi = (label: string) =>
      rows.find((r) => r.label === label)!.cells.find((c) => c.dayKey === "monday")!;
    expect(lundi("16:00 – 17:00").blocks).toHaveLength(0);
    expect(lundi("17:00 – 18:00").blocks).toHaveLength(1);
    expect(lundi("18:00 – 19:00").blocks).toHaveLength(1);
    expect(lundi("19:00 – 20:00").blocks).toHaveLength(0);
    expect(lundi("17:00 – 18:00").blocks[0].user).toBe("CLUB A");
  });

  it("laisse libres les autres jours à la même heure", () => {
    const rows = buildBookingGrid(semaine(), { startHour: 17, endHour: 18 });
    expect(rows[0].cells.filter((c) => c.blocks.length > 0).map((c) => c.dayKey)).toEqual(["monday"]);
  });

  it("élargit l'amplitude pour ne jamais masquer une réservation hors cadre", () => {
    // Amplitude 8h–10h, mais la réservation est à 17h : la grille doit descendre jusqu'à 19h,
    // sinon la case 17h serait absente (et donc implicitement « libre »).
    const rows = buildBookingGrid(semaine(), { startHour: 8, endHour: 10, slotMinutes: 60 });
    expect(rows[0].label).toBe("08:00 – 09:00");
    expect(rows[rows.length - 1].label).toBe("18:00 – 19:00");
    const occupee = rows.find((r) => r.startMinutes === 1020)!.cells.find((c) => c.dayKey === "monday")!;
    expect(occupee.blocks).toHaveLength(1);
  });

  it("applique les défauts 8h–22h au pas de 60 min", () => {
    const rows = buildBookingGrid([]);
    expect(rows).toHaveLength(14);
    expect(rows[0].startMinutes).toBe(480);
    expect(rows[13].endMinutes).toBe(1320);
  });

  it("honore un pas plus fin", () => {
    const rows = buildBookingGrid([], { startHour: 8, endHour: 9, slotMinutes: 30 });
    expect(rows.map((r) => r.label)).toEqual(["08:00 – 08:30", "08:30 – 09:00"]);
  });

  it("produit des clés de case uniques", () => {
    const rows = buildBookingGrid([], { startHour: 8, endHour: 10 });
    const keys = rows.flatMap((r) => r.cells.map((c) => c.key));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("mergeBookingRows", () => {
  const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  const creneau = (day: ReservationSlot["day"], start: string, end: string): ReservationSlot => ({
    day, start, end, startMinutes: minutes(start), endMinutes: minutes(end),
  });
  const grille = (...reservations: Reservation[]) =>
    mergeBookingRows(
      buildBookingGrid(buildWeeklyGrid(groupReservationsByUser(reservations)), { startHour: 8, endHour: 18 }),
    );
  /** Case du jour `jour` (0 = lundi) sur la rangée qui commence à `heure`. */
  const caseA = (rows: ReturnType<typeof grille>, heure: string, jour: number) =>
    rows.find((r) => r.startMinutes === minutes(heure))!.cells[jour];

  it("un créneau de 7 h 35 à 15 h 10 ne fait qu'UNE cellule, sur toutes les rangées qu'il recouvre", () => {
    const rows = grille(reservation({ id: "lycee", user: "Lycée", slots: [creneau("monday", "07:35", "15:10")] }));
    // La grille descend à 7 h pour ne pas masquer le créneau : rangées 7 h → 15 h, soit 9.
    expect(caseA(rows, "07:00", 0)).toMatchObject({ kind: "busy", rowSpan: 9 });
    for (const h of ["08:00", "12:00", "15:00"]) expect(caseA(rows, h, 0)).toEqual({ kind: "covered" });
    expect(caseA(rows, "16:00", 0).kind).toBe("free");
  });

  it("ne touche pas aux autres jours : une case par rangée", () => {
    const rows = grille(reservation({ id: "lycee", user: "Lycée", slots: [creneau("monday", "07:35", "15:10")] }));
    expect(rows.every((r) => r.cells.length === 7)).toBe(true);
    expect(rows.every((r) => r.cells[1].kind === "free")).toBe(true);
  });

  it("réunit dans une cellule les blocs qui s'enchevêtrent, et sépare ceux qui se suivent à l'heure pile", () => {
    const rows = grille(
      reservation({ id: "a", user: "A", slots: [creneau("tuesday", "08:00", "09:30")] }),
      reservation({ id: "b", user: "B", slots: [creneau("tuesday", "09:30", "11:00")] }),
      reservation({ id: "c", user: "C", slots: [creneau("tuesday", "11:00", "12:00")] }),
    );
    const plage = caseA(rows, "08:00", 1);
    expect(plage).toMatchObject({ kind: "busy", rowSpan: 3 });
    expect(plage.kind === "busy" && plage.blocks.map((b) => b.user)).toEqual(["A", "B"]);
    expect(caseA(rows, "11:00", 1)).toMatchObject({ kind: "busy", rowSpan: 1 });
  });
});

describe("minutesToLabel", () => {
  it("formate en 24 h zéro-paddé", () => {
    expect(minutesToLabel(0)).toBe("00:00");
    expect(minutesToLabel(540)).toBe("09:00");
    expect(minutesToLabel(1230)).toBe("20:30");
  });
});

/* ── Période propre d'un créneau ─────────────────────────────────────────── */

/** Créneau du lundi 17 h–19 h, avec sa période propre éventuelle. */
function lundi(period: Partial<Pick<ReservationSlot, "periodStart" | "periodEnd">> = {}): ReservationSlot {
  return { day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140, ...period };
}

const SAISON = { periodStart: "2026-08-17", periodEnd: "2027-07-02" };

describe("période propre d'un créneau", () => {
  it("parseReservationAnswer lit la période posée sur le créneau, et la laisse absente sinon", () => {
    const r = parseReservationAnswer(
      answerData({
        [FIELDS.slots]: [
          { ...slot("monday", "09", "40", "12", "00"), duree: 8400, periodStart: "2026-08-24", periodEnd: "2026-12-14" },
          slot("thursday", "17", "00", "19", "00"),
        ],
        [FIELDS.periodStart]: SAISON.periodStart,
        [FIELDS.periodEnd]: SAISON.periodEnd,
      }),
      CONF,
    )!;
    expect(r.slots[0]).toMatchObject({ periodStart: "2026-08-24", periodEnd: "2026-12-14" });
    expect(r.slots[1].periodStart).toBeUndefined();
    expect(r.slots[1].periodEnd).toBeUndefined();
  });

  it("slotPeriod : la période du créneau, borne par borne, sinon celle de la réservation", () => {
    expect(slotPeriod(lundi(), SAISON)).toEqual(SAISON);
    expect(slotPeriod(lundi({ periodStart: "2026-08-24", periodEnd: "2026-12-14" }), SAISON)).toEqual({
      periodStart: "2026-08-24",
      periodEnd: "2026-12-14",
    });
    expect(slotPeriod(lundi({ periodEnd: "2026-12-14" }), SAISON)).toEqual({
      periodStart: "2026-08-17",
      periodEnd: "2026-12-14",
    });
  });

  it("le bloc de la grille porte la période du créneau, pas celle de la saison", () => {
    const groups = groupReservationsByUser([
      reservation({ ...SAISON, slots: [lundi({ periodStart: "2026-08-24", periodEnd: "2026-12-14" })] }),
    ]);
    expect(buildWeeklyGrid(groups)[0].blocks[0]).toMatchObject({
      periodStart: "2026-08-24",
      periodEnd: "2026-12-14",
    });
  });

  it("reservationConflicts : un cycle d'août à novembre ne bloque pas le même créneau en décembre", () => {
    const cycle = existing({ ...SAISON, slots: [lundi({ periodStart: "2026-08-24", periodEnd: "2026-11-30" })] });
    expect(reservationConflicts(candidat(1020, 1140, { periodStart: "2026-12-01", periodEnd: "2026-12-18" }), [cycle])).toEqual([]);
    expect(reservationConflicts(candidat(1020, 1140, { periodStart: "2026-11-30", periodEnd: "2026-12-18" }), [cycle])).toHaveLength(1);
  });

  it("reservationConflicts : la période propre du créneau candidat prime sur celle de la réservation envisagée", () => {
    const cycle = existing({ ...SAISON, slots: [lundi({ periodStart: "2026-08-24", periodEnd: "2026-11-30" })] });
    const candidate = {
      ...SAISON,
      slots: [{ day: "monday" as const, startMinutes: 1020, endMinutes: 1140, periodStart: "2026-12-01" }],
    };
    expect(reservationConflicts(candidate, [cycle])).toEqual([]);
  });

  it("reservationsInPeriod : ne garde que les créneaux de la période, et les réservations qui en gardent un", () => {
    const deuxCycles = reservation({
      id: "deux",
      ...SAISON,
      slots: [lundi({ periodStart: "2026-08-24", periodEnd: "2026-11-30" }), lundi({ periodStart: "2026-12-01" })],
    });
    const passee = reservation({ id: "passee", periodStart: "2026-01-05", periodEnd: "2026-08-12", slots: [lundi()] });
    const decembre = reservationsInPeriod([deuxCycles, passee], { periodStart: "2026-12-01", periodEnd: "2026-12-31" });
    expect(decembre.map((r) => r.id)).toEqual(["deux"]);
    expect(decembre[0].slots).toEqual([lundi({ periodStart: "2026-12-01" })]);
  });

  it("reservationsInPeriod : rend la réservation elle-même quand rien n'est retiré", () => {
    const r = reservation({ ...SAISON, slots: [lundi()] });
    expect(reservationsInPeriod([r], { periodStart: "2026-10-23" })[0]).toBe(r);
  });

  it("reservationsInPeriod : une réservation sans créneau lisible se juge sur sa propre période", () => {
    const vide = reservation({ ...SAISON, slots: [] });
    expect(reservationsInPeriod([vide], { periodStart: "2026-10-23" })).toEqual([vide]);
    expect(reservationsInPeriod([vide], { periodStart: "2027-08-01" })).toEqual([]);
  });

  it("ownSlotPeriod : la période du créneau seulement quand elle diffère de celle de la réservation", () => {
    const r = reservation({ ...SAISON });
    expect(ownSlotPeriod(lundi(), r)).toBeNull();
    expect(ownSlotPeriod(lundi({ ...SAISON }), r)).toBeNull();
    expect(ownSlotPeriod(lundi({ periodEnd: "2026-12-14" }), r)).toEqual({
      periodStart: "2026-08-17",
      periodEnd: "2026-12-14",
    });
  });

  it("resourceGroupsInPeriod : ne garde que les créneaux de la période, recompte, écarte l'équipement vide", () => {
    const groupes = groupReservationsByResource([
      reservation({ id: "t1", resources: [{ id: "poi1", name: "Piscine" }], resourceIds: ["poi1"], periodStart: "2026-08-19", periodEnd: "2026-11-05", slots: [lundi(), lundi()] }),
      reservation({ id: "t2", resources: [{ id: "poi1", name: "Piscine" }], resourceIds: ["poi1"], periodStart: "2026-11-09", periodEnd: "2027-02-18", slots: [lundi()] }),
      reservation({ id: "passee", resources: [{ id: "poi2", name: "Gymnase" }], resourceIds: ["poi2"], periodStart: "2026-01-05", periodEnd: "2026-06-30", slots: [lundi()] }),
    ]);
    const enCours = resourceGroupsInPeriod(groupes, { periodStart: "2026-10-23" });
    expect(enCours.map((g) => `${g.resourceName}:${g.slotCount}:${g.reservations.map((r) => r.id).join("+")}`)).toEqual([
      "Piscine:3:t1+t2",
    ]);
    expect(resourceGroupsInPeriod(groupes, { periodStart: "2026-11-09" })[0].slotCount).toBe(1);
  });

  it("distinctPeriods : une ligne par période effective, triées, doublons et périodes vides écartés", () => {
    const t2 = reservation({ id: "t2", periodStart: "2026-11-09", periodEnd: "2027-02-18", slots: [lundi(), lundi()] });
    const t1 = reservation({ id: "t1", periodStart: "2026-08-19", periodEnd: "2026-11-05", slots: [lundi()] });
    const cycle = reservation({ id: "c", ...SAISON, slots: [lundi({ periodEnd: "2026-12-14" })] });
    const sansCreneau = reservation({ id: "v", periodStart: "2027-02-22", periodEnd: "2027-06-30" });
    const sansDate = reservation({ id: "x", slots: [lundi()] });
    expect(distinctPeriods([t2, t1, cycle, sansCreneau, sansDate])).toEqual([
      { periodStart: "2026-08-17", periodEnd: "2026-12-14" },
      { periodStart: "2026-08-19", periodEnd: "2026-11-05" },
      { periodStart: "2026-11-09", periodEnd: "2027-02-18" },
      { periodStart: "2027-02-22", periodEnd: "2027-06-30" },
    ]);
  });
});
