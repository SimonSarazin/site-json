import type { Answer, FormId } from "@communecter/cocolight-api-client";
import getValueByPath from "@/helpers/getValueByPath";

interface PriceAggregate {
  hourly: number;
  halfDay: number;
  fullDay: number;
}

export const ANSWER_PATH = {
  "meeting": {
    id: "6925869ad76aaf6c5a2b2f8a",
    room: "answers.navigatorDesTierslieux25112025_1436_0.navigatorDesTierslieux25112025_1436_0miokvr9ezvu0064fk",
  },
  "coworking": {
    id: "6925e2b05dd63b02ca70d6d9",
    place: "answers.navigatorDesTierslieux25112025_209_0.navigatorDesTierslieux25112025_209_0mieg4k7z9gv729cs53",
    price : {
        hourly: "answers.navigatorDesTierslieux25112025_209_0.navigatorDesTierslieux25112025_209_0minag948nw1ltatx78o",
        halfDay: "answers.navigatorDesTierslieux25112025_209_0.navigatorDesTierslieux25112025_209_0minagtkflgfepmrq32l",
        fullDay: "answers.navigatorDesTierslieux25112025_209_0.navigatorDesTierslieux25112025_209_0minah6jdpwjpzymuxm"
    }
  },
  "accommodation": {
    id: "6925ee8ac537f8056114aec7",
    place : "answers.navigatorDesTierslieux25112025_2059_0.navigatorDesTierslieux25112025_2059_0mieg4k7z9gv729cs53",
    price : {
      bed : "answers.navigatorDesTierslieux25112025_2059_0.navigatorDesTierslieux25112025_2059_0minaceqtibwcyy3khtm",
      room : "answers.navigatorDesTierslieux25112025_2059_0.navigatorDesTierslieux25112025_2059_0miq84do7c678u3c8xuq"
    }
  },
}

export interface TiersLieuxAggregate {
  meeting: { place: { min: number; max: number }; price: PriceAggregate, count: number };
  coworking: { place: number; price: PriceAggregate, count: number };
  accommodation: { place: number; price: { bed: number; room: number }, count: number };
}

/** parseInt sécurisé : `undefined` si la valeur n'est pas un entier. */
export function toInt(value: unknown): number | undefined {
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Agrégation « à partir de » (cf. JS d'origine) : tant que `current` vaut 0 on
 * prend la 1ʳᵉ valeur positive, ensuite on garde le minimum positif. Une valeur
 * absente ne modifie pas le courant.
 */
export function accumulateMin(current: number, value: number | undefined): number {
  if (current === 0) return Math.max(current, value ?? 0);
  return Math.min(current, value ?? current);
}

/**
 * Agrège, par catégorie de `ANSWER_PATH`, les réponses coform de `answers` :
 * capacités (places, min/max de personnes) et tarifs « à partir de ». Porte la
 * logique JS d'origine (Navigator des Tiers-Lieux). Fonction pure et testable.
 */
export function extractTiersLieuxAnswers(
  answers: Record<FormId, Answer[]> | undefined,
): TiersLieuxAggregate {
  const meeting = { place: { min: 0, max: 0 }, price: { hourly: 0, halfDay: 0, fullDay: 0 }, count: 0 };
  const coworking = { place: 0, price: { hourly: 0, halfDay: 0, fullDay: 0 }, count: 0 };
  const accommodation = { place: 0, price: { bed: 0, room: 0 }, count: 0 };

  Object.entries(ANSWER_PATH).forEach(([category, { id, ...fields }]) => {
    const raw: Answer[] | undefined = answers?.[id];
    if (!raw || !Array.isArray(raw) || raw.length === 0) return;

    if (category === "meeting") {
      const { room } = fields as { room: string };
      raw.forEach((doc) => {
        const rows = (getValueByPath(doc.serverData, room) ?? []) as unknown[];
        rows.forEach((row, index) => {
          if (index === 0 || !Array.isArray(row)) return; // ligne 0 = en-têtes
          meeting.price.hourly = accumulateMin(meeting.price.hourly, toInt(row[4]));
          meeting.price.halfDay = accumulateMin(meeting.price.halfDay, toInt(row[5]));
          meeting.price.fullDay = accumulateMin(meeting.price.fullDay, toInt(row[6]));
          meeting.place.min = accumulateMin(meeting.place.min, toInt(row[2]));
          meeting.place.max += toInt(row[3]) ?? 0;
          meeting.count += 1;
        });
      });
    } else if (category === "coworking") {
      const { place, price } = fields as {
        place: string;
        price: { hourly: string; halfDay: string; fullDay: string };
      };
      raw.forEach((doc) => {
        coworking.price.hourly = accumulateMin(coworking.price.hourly, toInt(getValueByPath(doc.serverData, price.hourly)));
        coworking.price.halfDay = accumulateMin(coworking.price.halfDay, toInt(getValueByPath(doc.serverData, price.halfDay)));
        coworking.price.fullDay = accumulateMin(coworking.price.fullDay, toInt(getValueByPath(doc.serverData, price.fullDay)));
        coworking.place += toInt(getValueByPath(doc.serverData, place)) ?? 0;
        coworking.count += 1;
      });
    } else if (category === "accommodation") {
      const { place, price } = fields as {
        place: string;
        price: { bed: string; room: string };
      };
      raw.forEach((doc) => {
        accommodation.price.bed = accumulateMin(accommodation.price.bed, toInt(getValueByPath(doc.serverData, price.bed)));
        accommodation.price.room = accumulateMin(accommodation.price.room, toInt(getValueByPath(doc.serverData, price.room)));
        accommodation.place += toInt(getValueByPath(doc.serverData, place)) ?? 0;
        accommodation.count += 1;
      });
    }
  });
  return { meeting, coworking, accommodation };
}

export type TiersLieuxStatKind = "coworking" | "meeting" | "accommodation";

/**
 * Stat de capacité affichée en pastille (icône + libellé). `count` = nb de
 * postes (coworking) ou de couverts (accommodation) ; `range` = capacité
 * min/max en personnes (meeting uniquement).
 */
export interface TiersLieuxStat {
  kind: TiersLieuxStatKind;
  count: number;
  range?: { min: number; max: number };
}

export type TiersLieuxPriceUnit = "hour" | "halfDay" | "fullDay" | "bed" | "room";

/** Service tarifé affiché « à partir de » : 1ʳᵉ unité de prix disponible. */
export interface TiersLieuxService {
  kind: TiersLieuxStatKind;
  unit: TiersLieuxPriceUnit;
  price: number;
}

const hasRentalPrice = (p: PriceAggregate): boolean => p.hourly > 0 || p.halfDay > 0 || p.fullDay > 0;
const hasMeetingCapacity = (m: TiersLieuxAggregate["meeting"]): boolean => m.place.min > 0 || m.place.max > 0;

/** 1ʳᵉ unité de prix disponible (horaire → demi-journée → journée). */
function firstRentalPrice(p: PriceAggregate): { unit: "hour" | "halfDay" | "fullDay"; price: number } | null {
  if (p.hourly > 0) return { unit: "hour", price: p.hourly };
  if (p.halfDay > 0) return { unit: "halfDay", price: p.halfDay };
  if (p.fullDay > 0) return { unit: "fullDay", price: p.fullDay };
  return null;
}

/** 1ʳᵉ unité de prix d'hébergement disponible (lit partagé → chambre). */
function firstLodgingPrice(p: { bed: number; room: number }): { unit: "bed" | "room"; price: number } | null {
  if (p.bed > 0) return { unit: "bed", price: p.bed };
  if (p.room > 0) return { unit: "room", price: p.room };
  return null;
}

/**
 * Construit les stats à afficher. `requirePrice` : n'afficher une catégorie que
 * si elle a au moins un tarif (vue détaillée) ; sinon la capacité seule suffit
 * (vue grille).
 */
export function buildTiersLieuxStats(
  agg: TiersLieuxAggregate,
  { requirePrice }: { requirePrice: boolean },
): TiersLieuxStat[] {
  const { coworking, meeting, accommodation } = agg;
  const stats: TiersLieuxStat[] = [];

  if (coworking.count > 0 && coworking.place > 0 && (!requirePrice || hasRentalPrice(coworking.price))) {
    stats.push({ kind: "coworking", count: coworking.place });
  }
  if (meeting.count > 0 && hasMeetingCapacity(meeting) && (!requirePrice || hasRentalPrice(meeting.price))) {
    stats.push({ kind: "meeting", count: 0, range: { ...meeting.place } });
  }
  if (
    accommodation.count > 0 &&
    accommodation.place > 0 &&
    (!requirePrice || accommodation.price.bed > 0 || accommodation.price.room > 0)
  ) {
    stats.push({ kind: "accommodation", count: accommodation.place });
  }
  return stats;
}

/** Construit la liste des services tarifés (« à partir de »). */
export function buildTiersLieuxServices(agg: TiersLieuxAggregate): TiersLieuxService[] {
  const { coworking, meeting, accommodation } = agg;
  const services: TiersLieuxService[] = [];

  const coworkingPrice = firstRentalPrice(coworking.price);
  if (coworking.count > 0 && coworking.place > 0 && coworkingPrice) {
    services.push({ kind: "coworking", ...coworkingPrice });
  }
  const meetingPrice = firstRentalPrice(meeting.price);
  if (meeting.count > 0 && hasMeetingCapacity(meeting) && meetingPrice) {
    services.push({ kind: "meeting", ...meetingPrice });
  }
  const lodgingPrice = firstLodgingPrice(accommodation.price);
  if (accommodation.count > 0 && accommodation.place > 0 && lodgingPrice) {
    services.push({ kind: "accommodation", ...lodgingPrice });
  }
  return services;
}

/** Formate une capacité min/max en « min-max », « min » ou « max » (sans unité). */
export function formatCapacityRange(range: { min: number; max: number }): string {
  const { min, max } = range;
  if (min > 0 && max > 0) return `${min}-${max}`;
  if (min > 0) return `${min}`;
  if (max > 0) return `${max}`;
  return "";
}

/**
 * Clé i18n + params d'un stat (partagé entre carte grille et carte détaillée).
 * Le composant appelle `t(key, params)` — i18n reste côté composant.
 */
export function tiersLieuxStatLabel(
  stat: TiersLieuxStat,
): { key: string; params: Record<string, string | number> } {
  if (stat.kind === "meeting") {
    return { key: "card.tiersLieux.meetingPersons", params: { value: formatCapacityRange(stat.range ?? { min: 0, max: 0 }) } };
  }
  if (stat.kind === "coworking") {
    return { key: "card.tiersLieux.coworkingPlaces", params: { value: stat.count } };
  }
  return { key: "card.tiersLieux.accommodationCovers", params: { value: stat.count } };
}
