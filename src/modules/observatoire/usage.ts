import type { useT } from "@/hooks/useT";
import { weeklyReservations } from "@/modules/search/lib/reservationHours";
import { periodsOverlap, slotPeriod, type Reservation } from "@/modules/search/lib/reservations";
import type { ReservationsConf } from "@/modules/search/schema";
import { computeEquipmentUsage, utilizationRate, weeklyAmplitudeMinutes } from "./installation";
import type { DimensionsConfig } from "./schema";

/**
 * Mesure d'USAGE des créneaux d'un équipement (`reservations.usage`, OPT-IN) — CDC ESS974 de la DRAJES :
 * statut d'ouverture, heures scolaires / clubs, heures libres et taux d'occupation. Une seule mesure, lue
 * par la fiche équipement, l'observatoire (champs `__usage.*` des items) et le filtre de statut du bandeau.
 *
 * Règles (arbitrage du 28/10, provisoires tant que la DRAJES n'a pas défini « ouvert ») :
 *  - école ou club : le type d'usager de la réponse (import des plannings) d'abord — scolaire si TOUTES ses
 *    valeurs accumulées le sont —, sinon le type de la fiche usagère ; ni l'un ni l'autre : non précisé ;
 *  - statut : « ouvert » avec au moins un créneau de club EN COURS OU À VENIR, « non ouvert » avec des
 *    créneaux seulement scolaires ou non précisés, « sans planning » sans aucun créneau en cours ou à venir ;
 *  - heures et taux : la SEMAINE TYPE de chaque équipement (`weeklyReservations`, même règle que sa fiche),
 *    chevauchements fusionnés (`computeEquipmentUsage`), rapportés à la plage de référence ; un équipement
 *    sans planning compte 0 h occupée et toute la plage libre.
 */

export type UsageConf = NonNullable<ReservationsConf["usage"]>;
export type Audience = "school" | "club" | "unknown";
export type UsageStatus = "open" | "closed" | "noPlanning";

export interface PoiUsage {
  status: UsageStatus;
  /** Minutes par semaine type — occupé total, puis par public (une même heure peut être scolaire ET club). */
  occupiedMinutes: number;
  schoolMinutes: number;
  clubMinutes: number;
  unknownMinutes: number;
  /** Plage de référence moins l'occupé, jamais négatif. */
  freeMinutes: number;
  /** Part de la plage occupée, NON bornée (un créneau hors plage peut la dépasser). */
  rate: number;
}

/** Champs posés sur un item de l'observatoire (`__usage.<champ>`), lus par les dimensions de la config. */
export interface UsageFields {
  status: string;
  open: boolean;
  /** 1 si ouvert, sinon 0 — compté par un KPI `sum`, indépendant de la langue (le statut est traduit). */
  openCount: number;
  occupiedHours: number;
  schoolHours: number;
  clubHours: number;
  unknownHours: number;
  freeHours: number;
  /** En %, arrondi à l'unité. */
  rate: number;
  rateBand?: string;
  clubHoursBand?: string;
}

/** Libellés traduits par l'appelant : statuts et tranches (`bandLabels`). */
export interface UsageLabels {
  status: Record<UsageStatus, string>;
  band: { zero: (unit: string) => string; range: (min: number, max: number, unit: string) => string; over: (min: number, unit: string) => string };
}

/** Séparateur des valeurs accumulées par l'import (`Costumize::importCreneauxEquipements`, « a | b »). */
const SEPARATEUR = "|";

export function audienceOf(r: Reservation, orgTypes: ReadonlyMap<string, string>, conf: UsageConf): Audience {
  const types = (r.userType ?? "").split(SEPARATEUR).map((t) => t.trim()).filter(Boolean);
  if (types.length > 0) return types.every((t) => conf.schoolUserTypes.includes(t)) ? "school" : "club";
  const orgType = r.userId ? orgTypes.get(r.userId) : undefined;
  if (orgType) return conf.schoolOrgTypes?.includes(orgType) ? "school" : "club";
  return "unknown";
}

/** Un créneau en cours ou à venir à `today`, de durée positive — la règle des heures (`hoursOf`). */
function activeSlots(r: Reservation, today: string) {
  return r.slots.filter((s) => s.endMinutes > s.startMinutes && periodsOverlap({ periodStart: today }, slotPeriod(s, r)));
}

function occupiedOf(reservations: readonly Reservation[], poiId: string): number {
  return computeEquipmentUsage(reservations, [poiId]).get(poiId)?.occupiedMinutes ?? 0;
}

/** Usage de CHAQUE équipement de `poiIds` (zéros sans créneau), d'après les réservations qui le pointent. */
export function computePoiUsage(
  reservations: readonly Reservation[],
  poiIds: readonly string[],
  today: string,
  orgTypes: ReadonlyMap<string, string>,
  conf: UsageConf,
): Map<string, PoiUsage> {
  const amplitude = weeklyAmplitudeMinutes(conf.referenceAmplitude);
  const byPoi = new Map<string, Reservation[]>();
  for (const r of reservations) {
    for (const id of r.resourceIds) {
      const list = byPoi.get(id);
      if (list) list.push(r);
      else byPoi.set(id, [r]);
    }
  }

  const out = new Map<string, PoiUsage>();
  for (const id of poiIds) {
    const own = byPoi.get(id) ?? [];
    // Statut : sur TOUS les créneaux en cours ou à venir — un club d'un cycle suivant ouvre l'équipement.
    let hasActive = false;
    let hasClub = false;
    for (const r of own) {
      if (activeSlots(r, today).length === 0) continue;
      hasActive = true;
      if (audienceOf(r, orgTypes, conf) === "club") hasClub = true;
    }
    // Heures : la semaine type de l'équipement, par public.
    const week = weeklyReservations(own, today);
    const parPublic: Record<Audience, Reservation[]> = { school: [], club: [], unknown: [] };
    for (const r of week) parPublic[audienceOf(r, orgTypes, conf)].push(r);
    const occupiedMinutes = occupiedOf(week, id);
    out.set(id, {
      status: hasClub ? "open" : hasActive ? "closed" : "noPlanning",
      occupiedMinutes,
      schoolMinutes: occupiedOf(parPublic.school, id),
      clubMinutes: occupiedOf(parPublic.club, id),
      unknownMinutes: occupiedOf(parPublic.unknown, id),
      freeMinutes: Math.max(0, amplitude - occupiedMinutes),
      rate: utilizationRate(occupiedMinutes, amplitude),
    });
  }
  return out;
}

/** Heures arrondies au dixième — l'arrondi de `formatHours`, en nombre pour les KPI `sum` / `avg`. */
const toHours = (minutes: number) => Math.round(minutes / 6) / 10;

/**
 * Tranche d'une valeur sur des seuils croissants : `≤ s0`, puis `]s(i-1), s(i)]`, puis `> dernier`. Les
 * libellés commencent par leur borne basse (« 0 % », « 0–25 % », « 25–50 % », « plus de 75 % ») : avec les
 * seuils d'ESS974 (0/25/50/75, 0/5/15), l'ordre alphabétique des options de filtre (`uniqSorted`) suit celui
 * des valeurs. Des seuils 5 puis 10 le casseraient (« 10–20 h » avant « 5–10 h »).
 */
export function bandLabel(value: number, thresholds: readonly number[], unit: string, labels: UsageLabels["band"]): string {
  const s = [...thresholds].sort((a, b) => a - b);
  if (value <= s[0]) return s[0] === 0 ? labels.zero(unit) : labels.range(0, s[0], unit);
  for (let i = 1; i < s.length; i++) {
    if (value <= s[i]) return labels.range(s[i - 1], s[i], unit);
  }
  return labels.over(s[s.length - 1], unit);
}

/** Les champs `__usage` d'un équipement — tranches seulement si `conf.bands` est déclaré. */
export function usageFields(u: PoiUsage, conf: UsageConf, labels: UsageLabels): UsageFields {
  const rate = Math.round(u.rate * 100);
  const clubHours = toHours(u.clubMinutes);
  return {
    status: labels.status[u.status],
    open: u.status === "open",
    openCount: u.status === "open" ? 1 : 0,
    occupiedHours: toHours(u.occupiedMinutes),
    schoolHours: toHours(u.schoolMinutes),
    clubHours,
    unknownHours: toHours(u.unknownMinutes),
    freeHours: toHours(u.freeMinutes),
    rate,
    ...(conf.bands
      ? {
          rateBand: bandLabel(rate, conf.bands.rate, "%", labels.band),
          clubHoursBand: bandLabel(clubHours, conf.bands.clubHours, "h", labels.band),
        }
      : {}),
  };
}

/** Organisations usagères des réservations (finder `userOrga`), sans doublon — à typer par leur fiche. */
export function usagerIdsOf(reservations: readonly Reservation[] | undefined): string[] {
  return [...new Set((reservations ?? []).map((r) => r.userId).filter((id): id is string => Boolean(id)))];
}

/** Dimensions qui lisent la mesure d'usage (un chemin `__usage.*`) : leurs KPI attendent la fin du calcul. */
export function usageDimensionIds(dims: DimensionsConfig): Set<string> {
  return new Set(Object.entries(dims).filter(([, d]) => d.paths.some((p) => p.startsWith("__usage."))).map(([id]) => id));
}

/** Libellés traduits des statuts et des tranches (namespace `modules/observatoire`, clés `usage.*`). */
export function usageLabelsFrom(t: ReturnType<typeof useT>): UsageLabels {
  return {
    status: { open: t("usage.status.open"), closed: t("usage.status.closed"), noPlanning: t("usage.status.noPlanning") },
    band: {
      zero: (unit) => t("usage.band.zero", undefined, { unit }),
      range: (min, max, unit) => t("usage.band.range", undefined, { min, max, unit }),
      over: (min, unit) => t("usage.band.over", undefined, { min, unit }),
    },
  };
}

/**
 * Items de l'observatoire avec leur `__usage` — `ids[i]` est l'identifiant de `items[i]` (même index que
 * les entités). Un item sans mesure (identifiant inconnu) est rendu tel quel.
 */
export function withUsage<T extends object>(
  items: readonly T[],
  ids: readonly (string | undefined)[],
  usage: ReadonlyMap<string, PoiUsage>,
  conf: UsageConf,
  labels: UsageLabels,
): Array<T & { __usage?: UsageFields }> {
  return items.map((item, i) => {
    const u = ids[i] ? usage.get(ids[i]!) : undefined;
    return u ? { ...item, __usage: usageFields(u, conf, labels) } : item;
  });
}
