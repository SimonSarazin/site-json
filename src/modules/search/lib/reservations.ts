import { DAY_KEYS, type DayKey, normalizeDayKey } from "./schedules";
import type { ReservationsConf } from "../schema";

/**
 * Lecture/normalisation des réservations récurrentes d'une ressource (answers
 * CoForm reliées par finder) — consommé par le preview `poi-amenities`
 * (section réservations) ET par le dashboard installation (observatoire).
 *
 * Helper distinct de `parseCoformAnswer` : ici les champs vivent SOUS
 * `serverData.answers[<step>]` (convention vérifiée en base), pas à la racine
 * du serverData (convention SSBE « aplatie »). Le mapping rôle→suffixe vient
 * de la config (`ReservationsConf`) — aucun identifiant de form dans le code.
 */

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface ReservationSlot {
  day: DayKey;
  /** "17:00" (24 h, zéro-paddé) — affichage. */
  start: string;
  end: string;
  /** Minutes depuis minuit — clés de tri de la grille et calcul de durée. */
  startMinutes: number;
  endMinutes: number;
}

export interface Reservation {
  /** Id de l'answer (clé React stable). */
  id: string;
  /** Ids des ressources pointées par le finder (souvent 1 — sert au
   *  regroupement par équipement du dashboard installation). */
  resourceIds: string[];
  /** "" si non renseigné (libellé de repli côté UI/i18n). */
  user: string;
  activity?: string;
  bookingType?: string;
  /** ISO "2026-01-01" — formatage locale laissé au composant. */
  periodStart?: string;
  periodEnd?: string;
  slots: ReservationSlot[];
}

export interface UserReservations {
  user: string;
  /** Index de couleur STABLE (ordre alphabétique global) — la couleur suit
   *  l'usager, indépendamment de l'ordre d'arrivée des answers. */
  colorIndex: number;
  activities: string[];
  reservations: Reservation[];
  slotCount: number;
}

export interface WeeklySlotBlock {
  /** `${reservationId}-${slotIndex}` — clé React unique. */
  key: string;
  dayKey: DayKey;
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
  user: string;
  activity?: string;
  bookingType?: string;
  periodStart?: string;
  periodEnd?: string;
  colorIndex: number;
}

export interface WeeklyGridDay {
  dayKey: DayKey;
  blocks: WeeklySlotBlock[];
}

/* ── Couleurs : tokens de thème UNIQUEMENT (précédent : CATEGORICAL_COLORS,
      observatoire/dashboard.ts) — jamais d'hex. L'identité n'est jamais portée
      par la couleur seule : le nom de l'usager reste toujours en texte. ───── */

export const RESERVATION_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function reservationColor(index: number): string {
  return RESERVATION_COLORS[((index % RESERVATION_COLORS.length) + RESERVATION_COLORS.length) % RESERVATION_COLORS.length];
}

/* ── Heures (tolérant : "9"/"09", minute absente, valeurs non numériques) ── */

/** Minutes depuis minuit, ou `null` si l'heure est inexploitable. */
export function toMinutes(hour: unknown, minute: unknown): number | null {
  const h = Number(hour);
  if (!Number.isFinite(h)) return null;
  const m = Number(minute);
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

/** "HH:MM" zéro-paddé ; repli sur la valeur brute si l'heure est inexploitable. */
export function formatSlotTime(hour: unknown, minute: unknown): string {
  const h = Number(hour);
  if (!Number.isFinite(h)) return String(hour ?? "");
  const m = Number(minute);
  const mm = Number.isFinite(m) ? m : 0;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/* ── Parsing ───────────────────────────────────────────────────────────── */

function parseSlot(raw: unknown): ReservationSlot | null {
  const s = raw as Record<string, unknown> | null;
  const day = normalizeDayKey(s?.day);
  const startMinutes = toMinutes(s?.startHour, s?.startMinute);
  // Jour ou heure de début invalide → slot ignoré (les autres sont conservés).
  if (!day || startMinutes === null) return null;
  const endMinutes = toMinutes(s?.endHour, s?.endMinute) ?? startMinutes;
  return {
    day,
    start: formatSlotTime(s?.startHour, s?.startMinute),
    end: formatSlotTime(s?.endHour, s?.endMinute),
    startMinutes,
    endMinutes,
  };
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

/**
 * Parse le `serverData` d'une answer en `Reservation`. `null` si l'étape est
 * absente. Ne filtre PAS sur un statut de validation (le champ « Valide » vaut
 * "Non" sur toutes les answers en base — décision actée).
 */
export function parseReservationAnswer(
  serverData: Record<string, unknown>,
  conf: Pick<ReservationsConf, "step" | "fields">,
): Reservation | null {
  const answers = serverData.answers as Record<string, unknown> | undefined;
  const step = answers?.[conf.step] as Record<string, unknown> | undefined;
  if (!step) return null;
  const get = (suffix?: string) =>
    suffix ? step[`${conf.step}${suffix}`] : undefined;

  const slotsRaw = get(conf.fields.slots);
  const slots = Array.isArray(slotsRaw)
    ? slotsRaw.map(parseSlot).filter((s): s is ReservationSlot => s !== null)
    : [];

  // Finder : `{<id>: {id, name, type}}` — on ne garde que les ids.
  const finderRaw = step[`finder${conf.step}${conf.fields.finder}`];
  const resourceIds =
    finderRaw && typeof finderRaw === "object" && !Array.isArray(finderRaw)
      ? Object.keys(finderRaw as Record<string, unknown>)
      : [];

  return {
    id:
      str(serverData.id)
      ?? str((serverData._id as { $id?: string } | undefined)?.$id)
      ?? "",
    resourceIds,
    user: str(get(conf.fields.user)) ?? "",
    activity: str(get(conf.fields.activity)),
    bookingType: str(get(conf.fields.bookingType)),
    periodStart: str(get(conf.fields.periodStart)),
    periodEnd: str(get(conf.fields.periodEnd)),
    slots,
  };
}

/* ── Regroupements ─────────────────────────────────────────────────────── */

/**
 * Groupe par usager, tri alphabétique stable (insensible casse/accents) —
 * `colorIndex` découle de cet ordre global : il ne dépend pas de l'ordre
 * d'arrivée des answers.
 */
export function groupReservationsByUser(list: Reservation[]): UserReservations[] {
  const byUser = new Map<string, Reservation[]>();
  for (const r of list) {
    const existing = byUser.get(r.user);
    if (existing) existing.push(r);
    else byUser.set(r.user, [r]);
  }
  return [...byUser.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr", { sensitivity: "base" }))
    .map(([user, reservations], colorIndex) => ({
      user,
      colorIndex,
      reservations,
      activities: [
        ...new Set(
          reservations
            .map((r) => r.activity)
            .filter((a): a is string => Boolean(a)),
        ),
      ],
      slotCount: reservations.reduce((n, r) => n + r.slots.length, 0),
    }));
}

/**
 * Grille hebdo : TOUJOURS 7 jours (Lun→Dim, jours vides inclus), blocs
 * empilés triés par heure de début puis fin puis usager (les chevauchements
 * s'empilent — pas de layout à échelle horaire absolue).
 */
export function buildWeeklyGrid(groups: UserReservations[]): WeeklyGridDay[] {
  const byDay = new Map<DayKey, WeeklySlotBlock[]>(
    DAY_KEYS.map((d) => [d, []]),
  );
  let resIndex = 0;
  for (const g of groups) {
    for (const r of g.reservations) {
      // `r.id` peut être "" (repli assumé) → clé positionnelle de repli pour
      // éviter des clés React dupliquées ("-0", "-0"…) entre réservations.
      const rKey = r.id || `res${resIndex}`;
      resIndex += 1;
      r.slots.forEach((s, i) => {
        byDay.get(s.day)!.push({
          key: `${rKey}-${i}`,
          dayKey: s.day,
          start: s.start,
          end: s.end,
          startMinutes: s.startMinutes,
          endMinutes: s.endMinutes,
          user: g.user,
          activity: r.activity,
          bookingType: r.bookingType,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          colorIndex: g.colorIndex,
        });
      });
    }
  }
  return DAY_KEYS.map((dayKey) => ({
    dayKey,
    blocks: byDay
      .get(dayKey)!
      .sort(
        (a, b) =>
          a.startMinutes - b.startMinutes
          || a.endMinutes - b.endMinutes
          || a.user.localeCompare(b.user, "fr"),
      ),
  }));
}
