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
  /** Période PROPRE du créneau (ISO), telle qu'enregistrée sur l'objet `timeSlots` — par l'import, qui
   *  date chaque cycle d'une saison, ou par la saisie au formulaire. Absente = toute la période de la
   *  réservation : la période qui compte est celle de `slotPeriod`, jamais ces seules bornes. */
  periodStart?: string;
  periodEnd?: string;
  /** Position du créneau dans le tableau `timeSlots` BRUT de la réponse — pas dans `slots`, dont la lecture
   *  écarte les créneaux illisibles. C'est elle que vise la modification d'horaire. Absente sur un créneau
   *  construit hors lecture (candidat d'un contrôle, test). */
  index?: number;
}

/** Ressource pointée par le finder d'une réservation. */
export interface ReservationResource {
  id: string;
  /** Nom PORTÉ PAR LA RÉPONSE, donc figé au moment de la réservation. Suffit à
   *  lister les équipements d'un club sans aller relire chaque POI ; absent sur
   *  une réponse dont le finder n'a enregistré que l'id. */
  name?: string;
}

export interface Reservation {
  /** Id de l'answer (clé React stable). */
  id: string;
  /** Ressources pointées par le finder (souvent 1), id ET nom. */
  resources: ReservationResource[];
  /** Ids seuls — vue dérivée de `resources`, conservée pour le regroupement par
   *  équipement du dashboard installation. */
  resourceIds: string[];
  /** "" si non renseigné (libellé de repli côté UI/i18n). */
  user: string;
  /** Id de l'organisation usagère, quand la réponse porte le finder `userOrga`.
   *  Absent sur les réponses historiques, qui ne connaissent l'usager que par son nom. */
  userId?: string;
  activity?: string;
  bookingType?: string;
  /** Type d'usager posé par l'import des plannings (« Etablissement scolaire | Association »…), quand
   *  `fields.userType` est configuré — lu par la mesure d'usage (`observatoire/usage.ts`). */
  userType?: string;
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
  /** Créneaux d'un même club fusionnés dans ce bloc parce qu'ils se suivent sans interruption (cf.
   *  `buildWeeklyGrid`), dans l'ordre. Absent sur un bloc d'un seul créneau. */
  parts?: WeeklySlotBlock[];
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

/** Un créneau BRUT (élément du tableau `timeSlots`) lu comme la grille le lit ; `null` s'il est illisible.
 *  Exporté pour relire, avant de l'écrire, le créneau qu'une modification d'horaire vise. */
export function parseSlot(raw: unknown, index: number): ReservationSlot | null {
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
    periodStart: str(s?.periodStart),
    periodEnd: str(s?.periodEnd),
    index,
  };
}

/**
 * Période EFFECTIVE d'un créneau : la sienne, borne par borne, sinon celle de sa réservation. Une
 * réservation vaut pour une saison et ses créneaux peuvent n'en occuper qu'un cycle (« du 24/08 au
 * 14/12 ») ; un créneau sans période — tous ceux d'avant cette convention — vaut pour toute la
 * réservation. Borne par borne : un créneau qui ne porte que sa fin commence avec la réservation.
 */
export function slotPeriod(
  slot: { periodStart?: string; periodEnd?: string },
  reservation: { periodStart?: string; periodEnd?: string },
): { periodStart?: string; periodEnd?: string } {
  return {
    periodStart: slot.periodStart ?? reservation.periodStart,
    periodEnd: slot.periodEnd ?? reservation.periodEnd,
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
    ? slotsRaw.map((raw, index) => parseSlot(raw, index)).filter((s): s is ReservationSlot => s !== null)
    : [];

  // Finder : `{<id>: {id, name, type}}` — id ET nom. Le nom est ce qui permet à
  // la fiche d'une organisation de nommer les équipements qu'elle réserve sans
  // une requête POI par ligne.
  const finderRaw = step[`finder${conf.step}${conf.fields.finder}`];
  const resources: ReservationResource[] =
    finderRaw && typeof finderRaw === "object" && !Array.isArray(finderRaw)
      ? Object.entries(finderRaw as Record<string, { name?: unknown }>).map(
          ([id, value]) => ({ id, name: str(value?.name) }),
        )
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
    resources,
    resourceIds: resources.map((r) => r.id),
    // Le nom du finder prime, le texte historique sert de repli : pendant la reprise,
    // les deux formes cohabitent dans la même grille.
    user: (orgaEntry ? str(orgaEntry[1]?.name) : undefined) ?? str(get(conf.fields.user)) ?? "",
    userId: orgaEntry ? orgaEntry[0] : undefined,
    activity: str(get(conf.fields.activity)),
    bookingType: str(get(conf.fields.bookingType)),
    userType: str(get(conf.fields.userType)),
    periodStart: str(get(conf.fields.periodStart)),
    periodEnd: str(get(conf.fields.periodEnd)),
    slots,
  };
}

/** Le créneau BRUT d'index `index` du tableau `timeSlots` d'une réponse (`serverData`), tel que stocké —
 *  ce qu'une modification d'horaire relit puis réécrit ; `undefined` si l'étape, le champ ou l'élément manque. */
export function rawSlotAt(
  serverData: Record<string, unknown> | undefined,
  conf: Pick<ReservationsConf, "step" | "fields">,
  index: number,
): Record<string, unknown> | undefined {
  const answers = serverData?.answers as Record<string, unknown> | undefined;
  const step = answers?.[conf.step] as Record<string, unknown> | undefined;
  const slots = step?.[`${conf.step}${conf.fields.slots}`];
  const raw = Array.isArray(slots) ? slots[index] : undefined;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
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

/** Réservations d'UNE ressource, pour la fiche d'une organisation. */
export interface ResourceReservations {
  resourceId: string;
  /** Libellé du finder ; "" quand aucune réponse du groupe n'en portait. */
  resourceName: string;
  reservations: Reservation[];
  slotCount: number;
}

/**
 * Groupe par RESSOURCE — le pendant de `groupReservationsByUser` pour la fiche
 * d'une organisation : une ligne par équipement réservé, tri alphabétique.
 *
 * Une réservation qui pointe PLUSIEURS ressources (finder multiple) compte dans
 * chacune : c'est le même créneau, il occupe bien les deux équipements.
 */
export function groupReservationsByResource(list: Reservation[]): ResourceReservations[] {
  const byResource = new Map<string, { name: string; reservations: Reservation[] }>();
  for (const r of list) {
    for (const res of r.resources) {
      const group = byResource.get(res.id);
      if (!group) {
        byResource.set(res.id, { name: res.name ?? "", reservations: [r] });
        continue;
      }
      group.reservations.push(r);
      // Le nom peut manquer sur une réponse et pas sur une autre : on retient
      // le premier connu plutôt que de laisser la ligne sans libellé.
      if (!group.name && res.name) group.name = res.name;
    }
  }
  return [...byResource.entries()]
    .map(([resourceId, group]) => ({
      resourceId,
      resourceName: group.name,
      reservations: group.reservations,
      slotCount: group.reservations.reduce((n, r) => n + r.slots.length, 0),
    }))
    .sort((a, b) => a.resourceName.localeCompare(b.resourceName, "fr", { sensitivity: "base" }));
}

/** Ordre des blocs d'un jour : heure de début, puis de fin, puis usager. */
function compareBlocks(a: WeeklySlotBlock, b: WeeklySlotBlock): number {
  return a.startMinutes - b.startMinutes
    || a.endMinutes - b.endMinutes
    || a.user.localeCompare(b.user, "fr");
}

/**
 * Fusionne les créneaux d'un même club qui se SUIVENT sans interruption — fin de l'un = début du suivant,
 * même activité, même période : « 07:30 – 09:30 » puis « 09:30 – 11:30 » ne font plus qu'un bloc
 * « 07:30 – 11:30 ». Un emploi du temps scolaire découpe la journée en séances, et la grille montrait une
 * carte par séance là où le club occupe l'équipement d'un seul tenant (demande de Peterson du 23/10). Le club
 * se reconnaît à son `colorIndex`, propre à chaque groupe. Les créneaux fusionnés restent dans `parts`, que
 * le détail énumère. `blocks` doit être trié par heure de début.
 */
function fuseContiguous(blocks: readonly WeeklySlotBlock[]): WeeklySlotBlock[] {
  const out: WeeklySlotBlock[] = [];
  // Clé de fusion → position, dans `out`, du dernier bloc de la chaîne.
  const lastOf = new Map<string, number>();
  for (const b of blocks) {
    const cle = [b.colorIndex, b.activity ?? "", b.periodStart ?? "", b.periodEnd ?? ""].join("|");
    const at = lastOf.get(cle);
    const prev = at === undefined ? undefined : out[at];
    // Une durée nulle ou inversée (donnée dégradée) ne prolonge rien et n'est prolongée par rien.
    if (
      at !== undefined && prev
      && prev.endMinutes === b.startMinutes
      && prev.startMinutes < prev.endMinutes
      && b.startMinutes < b.endMinutes
    ) {
      out[at] = { ...prev, end: b.end, endMinutes: b.endMinutes, parts: [...(prev.parts ?? [prev]), b] };
      continue;
    }
    lastOf.set(cle, out.length);
    out.push(b);
  }
  return out;
}

/**
 * Grille hebdo : TOUJOURS 7 jours (Lun→Dim, jours vides inclus), blocs
 * empilés triés par heure de début puis fin puis usager (les chevauchements
 * s'empilent — pas de layout à échelle horaire absolue). Les créneaux d'un même
 * club qui se suivent sans interruption ne forment qu'un bloc (`fuseContiguous`).
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
          // La période du BLOC est celle du créneau : celle de la réservation dirait « toute la saison »
          // d'un créneau qui n'en occupe qu'un cycle.
          ...slotPeriod(s, r),
          colorIndex: g.colorIndex,
        });
      });
    }
  }
  // Trié avant la fusion (elle suit l'ordre des débuts), retrié après : un bloc fusionné finit plus tard.
  return DAY_KEYS.map((dayKey) => ({
    dayKey,
    blocks: fuseContiguous(byDay.get(dayKey)!.sort(compareBlocks)).sort(compareBlocks),
  }));
}

/* ── Détection de conflit ──────────────────────────────────────────────── */

/** Créneau candidat : le minimum nécessaire au calcul (pas de libellés). Sa période propre, s'il en a
 *  une, prime sur celle de la réservation envisagée (cf. `slotPeriod`). */
export interface CandidateSlot {
  day: DayKey;
  startMinutes: number;
  endMinutes: number;
  periodStart?: string;
  periodEnd?: string;
}

/** Réservation envisagée — créneaux hebdo + période de validité (bornes ISO). */
export interface ReservationCandidate {
  slots: CandidateSlot[];
  periodStart?: string;
  periodEnd?: string;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Jour calendaire RÉEL (`2026-02-30` refusé), vérifié en UTC pour ne dépendre d'aucun fuseau. */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO_DAY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * Borne ISO exploitable : les 10 premiers caractères (une date-heure garde son
 * jour), s'ils forment un jour calendaire réel (`isIsoDay`) ; `null` si la
 * valeur est absente, malformée ou impossible (`2026-02-30`). Seule notion de
 * borne des réservations : chevauchements (`periodsOverlap`) et heures
 * (`reservationHours`). Une borne `null` vaut « pas de limite » : le
 * recouvrement de périodes est alors présumé, donc le conflit est SIGNALÉ. On
 * préfère un faux positif (l'usager voit un avertissement sur un créneau
 * libre) à un faux négatif (deux clubs dans le même gymnase à la même heure).
 */
export function isoBound(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const day = value.slice(0, 10);
  return isIsoDay(day) ? day : null;
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
 * Réservations existantes en conflit avec une réservation envisagée : il faut,
 * sur un MÊME couple de créneaux, un chevauchement HEBDOMADAIRE **et** un
 * recouvrement des PÉRIODES — la période effective de chaque créneau
 * (`slotPeriod`), pas celle de sa réservation. Deux clubs sur le même créneau
 * à des saisons disjointes ne se gênent pas ; un cycle d'août à novembre ne
 * bloque pas le même créneau de décembre, même dans une réservation de saison.
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
  return existing.filter((r) =>
    r.slots.some((rs) =>
      candidate.slots.some(
        (cs) => slotsOverlap(cs, rs) && periodsOverlap(slotPeriod(cs, candidate), slotPeriod(rs, r)),
      ),
    ),
  );
}

/**
 * Filtre « du … au … » de la section réservations : chaque réservation ne garde
 * que ses créneaux dont la période EFFECTIVE recouvre `period`, bornes incluses
 * (`periodsOverlap`) ; une réservation sans créneau restant disparaît. Une
 * réservation SANS créneau lisible (donnée dégradée) se juge sur sa propre
 * période : l'écarter d'office la ferait disparaître de toute fiche filtrée.
 */
export function reservationsInPeriod(
  list: readonly Reservation[],
  period: { periodStart?: string; periodEnd?: string },
): Reservation[] {
  const out: Reservation[] = [];
  for (const r of list) {
    if (r.slots.length === 0) {
      if (periodsOverlap(r, period)) out.push(r);
      continue;
    }
    const slots = r.slots.filter((s) => periodsOverlap(slotPeriod(s, r), period));
    // Même objet quand rien n'est retiré : les regroupements en aval gardent leurs références.
    if (slots.length === r.slots.length) out.push(r);
    else if (slots.length > 0) out.push({ ...r, slots });
  }
  return out;
}

/** Les groupes par équipement (`groupReservationsByResource`) réduits aux créneaux d'une période
 *  (`reservationsInPeriod`) : un équipement sans créneau restant disparaît, son nombre de créneaux suit ce
 *  qui reste. Le filtre « du … au … » de la fiche d'une organisation. */
export function resourceGroupsInPeriod(
  groups: readonly ResourceReservations[],
  period: { periodStart?: string; periodEnd?: string },
): ResourceReservations[] {
  const out: ResourceReservations[] = [];
  for (const g of groups) {
    const reservations = reservationsInPeriod(g.reservations, period);
    if (reservations.length === 0) continue;
    out.push({ ...g, reservations, slotCount: reservations.reduce((n, r) => n + r.slots.length, 0) });
  }
  return out;
}

/** Période propre d'un créneau quand elle DIFFÈRE de celle de sa réservation — à afficher à côté du
 *  créneau ; `null` sinon (répéter la période de la réservation sur chaque ligne n'apprend rien). */
export function ownSlotPeriod(
  slot: ReservationSlot,
  reservation: { periodStart?: string; periodEnd?: string },
): { periodStart?: string; periodEnd?: string } | null {
  const effective = slotPeriod(slot, reservation);
  return effective.periodStart === reservation.periodStart && effective.periodEnd === reservation.periodEnd
    ? null
    : effective;
}

/**
 * Périodes EFFECTIVES distinctes d'une liste de réservations — celle de chaque créneau (`slotPeriod`), celle de
 * la réservation quand aucun créneau n'est lisible —, triées par début puis par fin. Depuis l'import « une
 * réservation par période » (23/10), un club a une réservation par trimestre ou par cycle : c'est la ligne qui
 * dit, fiche repliée, sur quelles périodes il occupe l'équipement. Une période sans aucune borne n'apprend rien :
 * elle est écartée.
 */
export function distinctPeriods(
  list: readonly Reservation[],
): Array<{ periodStart?: string; periodEnd?: string }> {
  const vues = new Map<string, { periodStart?: string; periodEnd?: string }>();
  const retenir = ({ periodStart, periodEnd }: { periodStart?: string; periodEnd?: string }) => {
    if (!periodStart && !periodEnd) return;
    const cle = `${periodStart ?? ""}|${periodEnd ?? ""}`;
    if (!vues.has(cle)) vues.set(cle, { periodStart, periodEnd });
  };
  for (const r of list) {
    if (r.slots.length === 0) retenir(r);
    for (const s of r.slots) retenir(slotPeriod(s, r));
  }
  return [...vues.values()].sort(
    (a, b) =>
      (a.periodStart ?? "").localeCompare(b.periodStart ?? "")
      || (a.periodEnd ?? "").localeCompare(b.periodEnd ?? ""),
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

/** Amplitude par défaut (8 h → 22 h), partagée avec le filtre créneau (`slotFilter.ts`) : une même
 *  journée de référence pour la grille de réservation et pour compléter un créneau à une seule borne. */
export const DEFAULT_START_HOUR = 8;
export const DEFAULT_END_HOUR = 22;
const DEFAULT_SLOT_MINUTES = 60;
/** Une journée, en minutes : plafond d'une grille (borne l'élargissement automatique des bornes), et fin
 *  d'un créneau du filtre créneau (`slotFilter.ts`) qui court jusqu'à minuit. */
export const JOURNEE_MINUTES = 24 * 60;
/** Un jour, en millisecondes : écart entre deux jours ISO (`slotFilter.ts`, `reservationHours.ts`). */
export const JOUR_MS = 24 * 60 * 60 * 1000;

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
  // Bornes élargies aux réservations hors cadre, alignées sur le pas, mais BORNÉES À LA JOURNÉE
  // dans les deux sens. `parseSlot` ne contraint ni les heures ni les minutes : un `endHour: "30"`
  // (saisie ou import erroné) faisait descendre la grille jusqu'à 30:00, avec des rangées
  // « 26:00 – 27:00 » que `minutesToLabel` produit sans broncher, et une donnée franchement
  // aberrante donnait des dizaines de milliers de rangées à rendre. La borne basse était déjà
  // plafonnée (`Math.max(0, …)`) ; la haute ne l'était pas.
  let from = confStart;
  let to = Math.max(confEnd, confStart + step);
  for (const b of all) {
    from = Math.min(from, Math.floor(b.startMinutes / step) * step);
    to = Math.max(to, Math.ceil(b.endMinutes / step) * step);
  }
  from = Math.min(Math.max(0, from), JOURNEE_MINUTES - step);
  to = Math.min(to, JOURNEE_MINUTES);

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
        // `b.endMinutes <= b.startMinutes` : créneau à durée nulle ou inversée — donnée dégradée
        // (format legacy 12 h dont `parseSlot` ignore l'AmPm : « 09 AM → 05 PM » ressort en
        // 540 → 300). Un tel bloc ne recouvre AUCUNE rangée par le test d'intersection, donc sa
        // case était rendue LIBRE et réservable alors qu'elle est occupée. On le rattache à la
        // rangée de son heure de début : la case cesse d'être proposée, et l'occupation redevient
        // visible — c'est le comportement qu'avait la grille historique, en lecture seule.
        blocks: (byDay.get(dayKey) ?? []).filter((b) =>
          b.endMinutes <= b.startMinutes
            ? b.startMinutes >= start && b.startMinutes < end
            : b.startMinutes < end && start < b.endMinutes,
        ),
      })),
    });
  }
  return rows;
}

/** Case de la grille de réservation une fois fusionnée verticalement (`mergeBookingRows`). */
export type MergedBookingCell =
  | { kind: "free"; cell: BookingCell }
  /** Plage occupée : une seule cellule sur `rowSpan` rangées, avec tous les blocs qui s'y enchaînent. */
  | { kind: "busy"; key: string; rowSpan: number; blocks: WeeklySlotBlock[] }
  /** Rangée absorbée par la cellule occupée du dessus : rien à rendre (pas de `<td>`). */
  | { kind: "covered" };

export interface MergedBookingRow {
  startMinutes: number;
  /** "18:00 – 19:00". */
  label: string;
  /** Toujours 7 cases, Lun→Dim — `covered` compris. */
  cells: MergedBookingCell[];
}

/**
 * Fusion VERTICALE de la grille de réservation, jour par jour : les rangées consécutives d'un même jour
 * occupées par un même bloc — ou par des blocs qui s'enchevêtrent — ne forment qu'une cellule, rendue avec
 * `rowSpan`. Un créneau de 7 h 35 à 15 h 10 recouvre 9 rangées d'une heure et y était répété 9 fois ; il
 * n'y a plus qu'une carte (demande de Peterson du 23/10). Chaque colonne se fusionne seule : les autres jours
 * ne bougent pas. Les cases libres restent une par rangée, chacune ouvrant son propre créneau.
 */
export function mergeBookingRows(rows: readonly BookingGridRow[]): MergedBookingRow[] {
  const merged: MergedBookingRow[] = rows.map((r) => ({ startMinutes: r.startMinutes, label: r.label, cells: [] }));
  const jours = rows[0]?.cells.length ?? 0;
  for (let d = 0; d < jours; d += 1) {
    let i = 0;
    while (i < rows.length) {
      const cell = rows[i].cells[d];
      if (cell.blocks.length === 0) {
        merged[i].cells[d] = { kind: "free", cell };
        i += 1;
        continue;
      }
      // La plage s'étend tant que la rangée suivante porte un bloc déjà rencontré ; les blocs nouveaux
      // qu'elle apporte la prolongent à leur tour.
      const cles = new Set(cell.blocks.map((b) => b.key));
      const blocks = [...cell.blocks];
      let j = i + 1;
      while (j < rows.length && rows[j].cells[d].blocks.some((b) => cles.has(b.key))) {
        for (const b of rows[j].cells[d].blocks) {
          if (!cles.has(b.key)) {
            cles.add(b.key);
            blocks.push(b);
          }
        }
        j += 1;
      }
      merged[i].cells[d] = { kind: "busy", key: cell.key, rowSpan: j - i, blocks: blocks.sort(compareBlocks) };
      for (let k = i + 1; k < j; k += 1) merged[k].cells[d] = { kind: "covered" };
      i = j;
    }
  }
  return merged;
}
