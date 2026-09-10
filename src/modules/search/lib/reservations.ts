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
  /** Id de l'organisation usagère, quand la réponse porte le finder `userOrga`.
   *  Absent sur les réponses historiques, qui ne connaissent l'usager que par son nom. */
  userId?: string;
  activity?: string;
  bookingType?: string;
  /** ISO "2026-01-01" — formatage locale laissé au composant. */
  periodStart?: string;
  periodEnd?: string;
  slots: ReservationSlot[];
}

export interface UserReservations {
  user: string;
  /** Id de l'organisation, dès qu'au moins une réservation du groupe le porte. */
  userId?: string;
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

  // Organisation usagère : le finder porte l'IDENTIFIANT en plus du nom, là où le champ
  // historique ne portait qu'un nom saisi à la main. Rangé sous la clé PRÉFIXÉE, comme
  // le finder de la ressource. `multiple: false` au formulaire, mais on lit la 1re entrée
  // sans s'y fier : une réponse ancienne ou saisie ailleurs pourrait en porter plusieurs.
  const orgaRaw = conf.fields.userOrga
    ? step[`finder${conf.step}${conf.fields.userOrga}`]
    : undefined;
  const orgaEntry =
    orgaRaw && typeof orgaRaw === "object" && !Array.isArray(orgaRaw)
      ? Object.entries(orgaRaw as Record<string, { name?: unknown }>)[0]
      : undefined;

  return {
    id:
      str(serverData.id)
      ?? str((serverData._id as { $id?: string } | undefined)?.$id)
      ?? "",
    resourceIds,
    // Le nom du finder prime, le texte historique sert de repli : pendant la reprise,
    // les deux formes cohabitent dans la même grille.
    user: (orgaEntry ? str(orgaEntry[1]?.name) : undefined) ?? str(get(conf.fields.user)) ?? "",
    userId: orgaEntry ? orgaEntry[0] : undefined,
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
/** Libellé plié : casse, accents, ponctuation et espaces multiples écrasés. */
function foldLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function groupReservationsByUser(list: Reservation[]): UserReservations[] {
  // PREMIÈRE passe : quel identifiant se cache derrière quel libellé ? Indispensable pendant la
  // reprise, où le même club arrive sous deux formes — « BASKET CLUB  SAINT-PAULOIS » saisi à la
  // main, sans identifiant, et « BASKET CLUB SAINT PAULOIS » choisi dans la liste, avec. Si l'on
  // se contentait de faire primer l'identifiant, les deux tomberaient dans des groupes distincts
  // et la grille donnerait deux couleurs à un seul club.
  const idParLibelle = new Map<string, string>();
  for (const r of list) {
    if (r.userId) {
      const k = foldLabel(r.user);
      if (k && !idParLibelle.has(k)) idParLibelle.set(k, r.userId);
    }
  }
  // Clé retenue : l'identifiant propre, sinon celui déduit du libellé, sinon le libellé plié.
  const cle = (r: Reservation) => {
    const plie = foldLabel(r.user);
    return r.userId ?? idParLibelle.get(plie) ?? plie;
  };

  const byUser = new Map<string, Reservation[]>();
  for (const r of list) {
    const key = cle(r);
    const existing = byUser.get(key);
    if (existing) existing.push(r);
    else byUser.set(key, [r]);
  }
  return [...byUser.values()]
    // Le libellé affiché est celui de la 1re réservation du groupe ; le tri porte sur lui,
    // plus sur la clé, qui peut désormais être un identifiant opaque.
    .sort((a, b) => a[0].user.localeCompare(b[0].user, "fr", { sensitivity: "base" }))
    .map((reservations, colorIndex) => ({
      user: reservations[0].user,
      userId: reservations.find((r) => r.userId)?.userId,
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

/* ── Détection de conflit ──────────────────────────────────────────────── */

/** Créneau candidat : le minimum nécessaire au calcul (pas de libellés). */
export interface CandidateSlot {
  day: DayKey;
  startMinutes: number;
  endMinutes: number;
}

/** Réservation envisagée — créneaux hebdo + période de validité (bornes ISO). */
export interface ReservationCandidate {
  slots: CandidateSlot[];
  periodStart?: string;
  periodEnd?: string;
}

/**
 * Borne ISO exploitable (`YYYY-MM-DD`), ou `null` si la valeur est absente ou
 * malformée. Une borne `null` vaut « pas de limite » : le recouvrement de
 * périodes est alors présumé, donc le conflit est SIGNALÉ. On préfère un faux
 * positif (l'usager voit un avertissement sur un créneau libre) à un faux
 * négatif (deux clubs dans le même gymnase à la même heure).
 */
function isoBound(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/**
 * Deux périodes se recouvrent-elles ? Bornes INCLUSES (une période
 * date-only couvre son dernier jour), bornes absentes = infinies.
 * La comparaison lexicographique est valide sur des dates ISO zéro-paddées.
 */
export function periodsOverlap(
  a: { periodStart?: string; periodEnd?: string },
  b: { periodStart?: string; periodEnd?: string },
): boolean {
  const aStart = isoBound(a.periodStart);
  const aEnd = isoBound(a.periodEnd);
  const bStart = isoBound(b.periodStart);
  const bEnd = isoBound(b.periodEnd);
  if (aStart && bEnd && aStart > bEnd) return false;
  if (bStart && aEnd && bStart > aEnd) return false;
  return true;
}

/**
 * Deux créneaux hebdomadaires se chevauchent-ils ? Même jour et intervalles
 * horaires sécants, en semi-ouvert `[début, fin)` : 17h–19h et 19h–20h30 se
 * SUIVENT, ils ne se chevauchent pas. Un créneau de durée nulle (donnée
 * dégradée : heure de fin illisible, cf. `parseSlot`) n'occupe aucun temps et
 * n'entre donc jamais en conflit.
 */
export function slotsOverlap(a: CandidateSlot, b: CandidateSlot): boolean {
  if (a.day !== b.day) return false;
  if (a.startMinutes >= a.endMinutes || b.startMinutes >= b.endMinutes) return false;
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

/**
 * Réservations existantes en conflit avec une réservation envisagée : il faut
 * un chevauchement du créneau HEBDOMADAIRE **et** un recouvrement de la
 * PÉRIODE — deux clubs sur le même créneau à des saisons disjointes ne se
 * gênent pas.
 *
 * `existing` est la liste DÉJÀ restreinte à la ressource visée (c'est ce que
 * `useReservationsQuery` retourne) : la fonction ne refiltre pas sur
 * `resourceIds`. Résultat sans doublon, dans l'ordre d'`existing`.
 */
export function reservationConflicts(
  candidate: ReservationCandidate,
  existing: Reservation[],
): Reservation[] {
  if (candidate.slots.length === 0) return [];
  return existing.filter(
    (r) =>
      periodsOverlap(candidate, r)
      && r.slots.some((rs) => candidate.slots.some((cs) => slotsOverlap(cs, rs))),
  );
}

/* ── Grille de réservation (échelle horaire) ───────────────────────────── */

/** Une case de la grille : un créneau d'un jour, avec ses occupants. */
export interface BookingCell {
  key: string;
  dayKey: DayKey;
  startMinutes: number;
  endMinutes: number;
  /** "18:00" / "19:00" — affichage. */
  start: string;
  end: string;
  /** Réservations qui recouvrent la case (vide = case libre). */
  blocks: WeeklySlotBlock[];
}

/** Une rangée horaire : la même tranche pour les 7 jours. */
export interface BookingGridRow {
  startMinutes: number;
  endMinutes: number;
  /** "18:00 – 19:00". */
  label: string;
  /** Toujours 7 cases, Lun→Dim. */
  cells: BookingCell[];
}

export interface BookingAmplitude {
  /** Première heure affichée. Défaut 8. */
  startHour?: number;
  /** Dernière heure affichée, exclue. Défaut 22. */
  endHour?: number;
  /** Pas de la grille en minutes. Défaut 60. */
  slotMinutes?: number;
}

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 22;
const DEFAULT_SLOT_MINUTES = 60;

/** Minutes depuis minuit → "HH:MM" (24 h, zéro-paddé). */
export function minutesToLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Découpe la semaine en rangées horaires régulières.
 *
 * L'amplitude configurée n'est qu'un CADRAGE d'affichage : elle est étendue
 * pour englober toute réservation existante qui déborde (sinon un créneau à 7 h
 * disparaîtrait silencieusement de la grille — et la case correspondante
 * serait proposée comme libre, ce qui serait faux).
 *
 * Une case est occupée dès qu'un bloc la RECOUVRE, même partiellement : un
 * créneau 17 h–19 h occupe les deux rangées 17-18 et 18-19.
 */
export function buildBookingGrid(
  grid: WeeklyGridDay[],
  amplitude: BookingAmplitude = {},
): BookingGridRow[] {
  const step = Math.max(1, amplitude.slotMinutes ?? DEFAULT_SLOT_MINUTES);
  const confStart = (amplitude.startHour ?? DEFAULT_START_HOUR) * 60;
  const confEnd = (amplitude.endHour ?? DEFAULT_END_HOUR) * 60;

  const all = grid.flatMap((d) => d.blocks);
  // Bornes élargies aux réservations hors cadre, alignées sur le pas.
  let from = confStart;
  let to = Math.max(confEnd, confStart + step);
  for (const b of all) {
    from = Math.min(from, Math.floor(b.startMinutes / step) * step);
    to = Math.max(to, Math.ceil(b.endMinutes / step) * step);
  }
  from = Math.max(0, from);

  const byDay = new Map<DayKey, WeeklySlotBlock[]>(grid.map((d) => [d.dayKey, d.blocks]));
  const rows: BookingGridRow[] = [];
  for (let start = from; start < to; start += step) {
    const end = start + step;
    rows.push({
      startMinutes: start,
      endMinutes: end,
      label: `${minutesToLabel(start)} – ${minutesToLabel(end)}`,
      cells: DAY_KEYS.map((dayKey) => ({
        key: `${dayKey}-${start}`,
        dayKey,
        startMinutes: start,
        endMinutes: end,
        start: minutesToLabel(start),
        end: minutesToLabel(end),
        blocks: (byDay.get(dayKey) ?? []).filter(
          (b) => b.startMinutes < end && start < b.endMinutes,
        ),
      })),
    });
  }
  return rows;
}
