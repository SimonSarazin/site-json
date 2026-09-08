import { describe, it, expect } from "vitest";
import {
  RESERVATION_COLORS,
  reservationColor,
  toMinutes,
  formatSlotTime,
  parseReservationAnswer,
  groupReservationsByUser,
  buildWeeklyGrid,
  reservationConflicts,
  slotsOverlap,
  periodsOverlap,
  buildBookingGrid,
  minutesToLabel,
  type Reservation,
  type CandidateSlot,
  type ReservationCandidate,
} from "./reservations";

/* ── Fixtures ────────────────────────────────────────────────────────────── */

const STEP = "step2026_0";
const FIELDS = {
  finder: "fFinder",
  user: "fUser",
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
    // Le finder est préfixé `finder<step>` (convention vérifiée en base).
    const key = suffix === FIELDS.finder ? `finder${STEP}${suffix}` : `${STEP}${suffix}`;
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
      { day: "thursday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 },
      { day: "monday", start: "17:00", end: "19:00", startMinutes: 1020, endMinutes: 1140 },
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
  });

  it("normalise un usager vide/espaces en chaîne vide", () => {
    const sd = answerData({ [FIELDS.user]: "   " });
    expect(parseReservationAnswer(sd, CONF)!.user).toBe("");
  });

  it("laisse les champs optionnels undefined quand absents", () => {
    const r = parseReservationAnswer(answerData({}), CONF)!;
    expect(r.activity).toBeUndefined();
    expect(r.bookingType).toBeUndefined();
    expect(r.periodStart).toBeUndefined();
    expect(r.periodEnd).toBeUndefined();
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

  it("liste plusieurs ressources si le finder en pointe plusieurs", () => {
    const sd = answerData({
      [FIELDS.finder]: { poi1: { id: "poi1" }, poi2: { id: "poi2" } },
    });
    expect(parseReservationAnswer(sd, CONF)!.resourceIds).toEqual(["poi1", "poi2"]);
  });
});

/* ── groupReservationsByUser ─────────────────────────────────────────────── */

describe("groupReservationsByUser", () => {
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
          { day: "monday", start: "08:00", end: "09:00", startMinutes: 480, endMinutes: 540 },
        ],
      }),
    ]);
    const monday = buildWeeklyGrid(groups)[0];
    expect(monday.blocks.map((b) => `${b.start}-${b.end} ${b.user}`)).toEqual([
      "08:00-09:00 Alpha",
      "09:00-10:00 Alpha",
      "09:00-11:00 Zeta",
    ]);
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

describe("minutesToLabel", () => {
  it("formate en 24 h zéro-paddé", () => {
    expect(minutesToLabel(0)).toBe("00:00");
    expect(minutesToLabel(540)).toBe("09:00");
    expect(minutesToLabel(1230)).toBe("20:30");
  });
});
