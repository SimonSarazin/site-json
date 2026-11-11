/**
 * Dates de co-kanban : des ENTIERS EN SECONDES, partout (blueprint D2).
 *
 * Le JOUR CIVIL d'une date — celui qu'on affiche, qu'on saisit, et avec lequel
 * on decide « aujourd'hui » ou « en retard » — se lit dans un FUSEAU qui depend
 * de la source du tableau (`DateZone`, choisi par `dateZoneFor` de
 * `lib/boardSource`) :
 *
 *  - `utc`, le defaut : board kanban. co-kanban y ecrit les echeances a minuit
 *    UTC et les lit en UTC. Une date civile stable pour tout le monde : formater
 *    dans le fuseau local ferait basculer une echeance « au 17 » sur « le 16 »
 *    pour un visiteur a l'ouest de Greenwich.
 *  - `local` : board-lien Communecter. Les actions sont des INSTANTS que Kanban
 *    gestion saisit et relit dans le fuseau du NAVIGATEUR (`moment(...)` de la
 *    modale d'action, `getDate()` de `convertirTimestampEnDate`) : en base,
 *    4 582 echeances sur 4 634 portent une heure locale (00:00 a La Reunion =
 *    20:00 UTC la veille). Les lire en UTC decalait d'un jour l'affichage, le
 *    champ de saisie et le calcul du retard par rapport a gestion.
 *
 * Les INSTANTS d'activite (cloche, Vue d'ensemble) ne sont pas des jours civils
 * partages : ils se lisent a l'heure du lecteur, donc en `local` — mais
 * seulement une fois la page hydratee (`zone` de `useBoardActivity`).
 *
 * Hydratation : le fuseau `local` n'est JAMAIS rencontre au rendu serveur —
 * aucune donnee de tableau n'y est rendue, le jeton vivant dans le navigateur
 * (cf. `routes.tsx`), et les instants d'activite y restent en `utc`. Le rendu
 * serveur et le premier rendu client restent donc identiques ; c'etait la
 * raison historique du « tout UTC ».
 *
 * Le formatage passe TOUJOURS par des formateurs `Intl` en UTC : pour le fuseau
 * local, on convertit d'abord l'instant en HEURE MURALE locale (lue par les
 * accesseurs de `Date`), puis on la formate comme une date UTC. Un seul cache de
 * formateurs, et aucun formateur fige sur le fuseau du moment de sa creation.
 */

export const SECONDS_PER_DAY = 86_400;

const MS_PER_DAY = SECONDS_PER_DAY * 1000;

/** Fuseau du jour civil : `utc` (board kanban, le defaut) ou `local` (board-lien). */
export type DateZone = 'utc' | 'local';

/**
 * Borne du jour choisie a la saisie d'une date dans le fuseau `local` : le
 * DEBUT pour une date de debut, la FIN pour une echeance. Ainsi une echeance
 * posee le jour du debut reste posterieure au debut horodate d'une action
 * (`card/create` pose « maintenant » en « En cours ») : le serveur compare les
 * instants, et refusait une echeance a minuit le jour meme.
 */
export type DayEdge = 'start' | 'end';

/** En deca de ce delai, une echeance est signalee comme imminente. */
export const DUE_SOON_DAYS = 3;

/** Miroir de `SUPPORTED_LANGUAGES` sans importer le singleton i18next. */
export type DateLocale = 'fr' | 'en';

/** Horodatage courant, en secondes (meme unite que le backend). */
export function nowTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/** Horodatage exploitable : un nombre fini (ni `null`, ni `NaN`). */
function isTimestamp(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function toDate(timestamp: number | null | undefined): Date | null {
  return isTimestamp(timestamp) ? new Date(timestamp * 1000) : null;
}

export function toTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Minuit UTC du jour contenant `timestamp`. */
export function startOfUtcDay(timestamp: number): number {
  return Math.floor(timestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}

/**
 * Numero du jour CIVIL de `timestamp` dans `zone` (jours depuis le 1er janvier
 * 1970). Deux instants du meme jour civil ont le meme numero : c'est l'unite de
 * toutes les comparaisons « a la journee » (retard, aujourd'hui, debut <=
 * echeance). Les accesseurs locaux de `Date` gerent les changements d'heure.
 */
export function civilDayIndex(timestamp: number, zone: DateZone = 'utc'): number {
  if (zone === 'utc') return Math.floor(timestamp / SECONDS_PER_DAY);
  const date = new Date(timestamp * 1000);
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

/**
 * Heure MURALE de l'instant dans `zone`, exprimee comme une date UTC : c'est ce
 * que les formateurs (tous en UTC) savent afficher. Identite pour `utc`.
 */
function wallClock(timestamp: number, zone: DateZone): Date {
  const date = new Date(timestamp * 1000);
  if (zone === 'utc') return date;
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
    ),
  );
}

/**
 * Valeur d'un `<input type="date">` (`YYYY-MM-DD`), ou chaine vide.
 *
 * L'inverse exact de `fromDateInputValue` dans la meme zone : saisir puis
 * relire une date ne doit jamais la decaler d'un jour.
 */
export function toDateInputValue(timestamp: number | null | undefined, zone: DateZone = 'utc'): string {
  return isTimestamp(timestamp) ? wallClock(timestamp, zone).toISOString().slice(0, 10) : '';
}

/**
 * Instant d'une saisie `YYYY-MM-DD`, ou `null` si la chaine n'est pas une date.
 *
 * Fuseau `utc` : minuit UTC (la borne `end` donne 23:59:59 UTC). Fuseau
 * `local` : debut ou fin du jour dans le fuseau du navigateur, cf. `DayEdge`.
 */
export function fromDateInputValue(value: string, zone: DateZone = 'utc', edge: DayEdge = 'start'): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day);
  // `Date.UTC` accepte 2026-02-31 en le decalant : on refuse au lieu de
  // stocker silencieusement une date que l'utilisateur n'a pas saisie.
  const rebuilt = new Date(utc);
  if (rebuilt.getUTCMonth() !== month - 1 || rebuilt.getUTCDate() !== day) return null;
  if (zone === 'utc') return Math.floor(utc / 1000) + (edge === 'end' ? SECONDS_PER_DAY - 1 : 0);
  const local =
    edge === 'end' ? new Date(year, month - 1, day, 23, 59, 59) : new Date(year, month - 1, day, 0, 0, 0);
  return Math.floor(local.getTime() / 1000);
}

/**
 * Horodatage d'une saisie `YYYY-MM-DD`, en GARDANT `current` s'il tombe deja ce
 * jour-la dans `zone`. Re-saisir le jour affiche ne doit ni rendre la fiche
 * « modifiee », ni reecrire l'heure qu'une action porte depuis Kanban gestion
 * (« 30/12 18:00 » deviendrait « 30/12 23:59 »).
 */
export function reconcileDateInput(
  value: string,
  current: number | null | undefined,
  zone: DateZone = 'utc',
  edge: DayEdge = 'start',
): number | null {
  if (isTimestamp(current) && toDateInputValue(current, zone) === value) return current;
  return fromDateInputValue(value, zone, edge);
}

/* -------------------------------------------------------------------------- */
/*  Formatage                                                                 */
/* -------------------------------------------------------------------------- */

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: DateLocale, options: Intl.DateTimeFormatOptions, cacheKey: string) {
  const key = `${locale}:${cacheKey}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    // Construire un Intl.DateTimeFormat coute cher : une liste de 200 cartes
    // en creerait autant sans ce cache.
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

/** Date courte et lisible : « 17 sept. 2026 » / « Sep 17, 2026 ». */
export function formatDate(
  timestamp: number | null | undefined,
  locale: DateLocale,
  zone: DateZone = 'utc',
): string {
  if (!isTimestamp(timestamp)) return '';
  return getFormatter(locale, { day: 'numeric', month: 'short', year: 'numeric' }, 'short').format(
    wallClock(timestamp, zone),
  );
}

/**
 * Jour et mois sans l'annee : « 19 août » / « Aug 19 » — la forme compacte de la
 * maquette (echeance d'une carte, debut d'une periode de tuile). A n'employer
 * que quand l'annee va de soi (`sameCivilYear`) : seule, elle mentirait sur une
 * date d'une autre annee.
 */
export function formatDayMonth(timestamp: number, locale: DateLocale, zone: DateZone = 'utc'): string {
  return getFormatter(locale, { day: 'numeric', month: 'short' }, 'dayMonth').format(wallClock(timestamp, zone));
}

/**
 * Les deux instants tombent-ils la meme annee CIVILE dans `zone` ? Decide si
 * l'annee peut etre omise (« 19 août – 29 août 2026 », « 22 oct. »). En UTC, le
 * 31 decembre 23 h a La Reunion est deja l'annee suivante : la zone compte.
 */
export function sameCivilYear(left: number, right: number, zone: DateZone = 'utc'): boolean {
  return wallClock(left, zone).getUTCFullYear() === wallClock(right, zone).getUTCFullYear();
}

/** Date longue, pour les `title`/`aria-label` ou l'ambiguite coute cher. */
export function formatLongDate(
  timestamp: number | null | undefined,
  locale: DateLocale,
  zone: DateZone = 'utc',
): string {
  if (!isTimestamp(timestamp)) return '';
  return getFormatter(locale, { day: 'numeric', month: 'long', year: 'numeric' }, 'long').format(
    wallClock(timestamp, zone),
  );
}

export function formatDateTime(
  timestamp: number | null | undefined,
  locale: DateLocale,
  zone: DateZone = 'utc',
): string {
  if (!isTimestamp(timestamp)) return '';
  return getFormatter(
    locale,
    { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    'datetime',
  ).format(wallClock(timestamp, zone));
}

const relativeFormatters = new Map<DateLocale, Intl.RelativeTimeFormat>();

/**
 * « demain », « il y a 3 jours »… en jours CIVILS de la zone.
 *
 * `numeric: 'auto'` donne « hier »/« demain » plutot que « il y a 1 jour ».
 */
export function formatRelativeDays(
  timestamp: number | null | undefined,
  locale: DateLocale,
  now: number = nowTimestamp(),
  zone: DateZone = 'utc',
): string {
  if (!isTimestamp(timestamp)) return '';
  let formatter = relativeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeFormatters.set(locale, formatter);
  }
  return formatter.format(daysUntil(timestamp, now, zone), 'day');
}

/* -------------------------------------------------------------------------- */
/*  Echeances                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Nombre de jours CIVILS entre aujourd'hui et l'echeance (negatif = passe).
 *
 * Compte en jours entiers et non en tranches de 24 h : une echeance a 23 h ce
 * soir doit afficher « aujourd'hui », pas « dans 0,9 jour ».
 */
export function daysUntil(timestamp: number, now: number = nowTimestamp(), zone: DateZone = 'utc'): number {
  return civilDayIndex(timestamp, zone) - civilDayIndex(now, zone);
}

/**
 * RG-25 : une carte close n'est jamais en retard, meme passee l'echeance.
 *
 * Ne voit que `completedAt` : sur un board-lien, une action « Terminé » close
 * avant l'historique a `completedAt: null` (§11.9 E11). Pour une CARTE, passer
 * par `isCardOverdue` (`lib/boardStats`), qui regarde aussi son statut.
 */
export function isOverdue(
  dueDate: number | null | undefined,
  completedAt: number | null | undefined,
  now: number = nowTimestamp(),
  zone: DateZone = 'utc',
): boolean {
  if (!isTimestamp(dueDate) || isTimestamp(completedAt)) return false;
  return civilDayIndex(dueDate, zone) < civilDayIndex(now, zone);
}

export type DueStatus = 'none' | 'done' | 'overdue' | 'today' | 'soon' | 'later';

/**
 * Etat d'echeance d'une carte, pour choisir un ton visuel.
 *
 * L'etat est une DONNEE, pas une couleur : l'interface doit aussi porter un
 * libelle ou une icone, l'information ne peut pas reposer sur la seule couleur.
 */
export function dueStatus(
  dueDate: number | null | undefined,
  completedAt: number | null | undefined,
  now: number = nowTimestamp(),
  zone: DateZone = 'utc',
): DueStatus {
  if (!isTimestamp(dueDate)) return 'none';
  if (isTimestamp(completedAt)) return 'done';
  const days = daysUntil(dueDate, now, zone);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return days <= DUE_SOON_DAYS ? 'soon' : 'later';
}

/* -------------------------------------------------------------------------- */
/*  Periodes                                                                  */
/* -------------------------------------------------------------------------- */

/** Traducteur minimal : la cle et ses valeurs interpolees (signature compatible `t`). */
export type DateLabelTranslate = (key: string, values: Record<string, string>) => string;

/**
 * Libelle d'une periode : « Du 3 sept. au 9 oct. », « A partir du… »,
 * « Jusqu'au… », ou « Aucune date definie ».
 *
 * Partage par la boite et la vue des jalons, et par les tuiles de projet pour
 * une borne seule (`projectDateLabel`, qui a sa forme compacte quand les deux
 * bornes existent) : quatre branches recopiees dans chaque ecran finissent
 * toujours par diverger sur un cas.
 */
export function dateRangeLabel(
  start: number | null | undefined,
  end: number | null | undefined,
  locale: DateLocale,
  translate: DateLabelTranslate,
  zone: DateZone = 'utc',
): string {
  const from = formatDate(start, locale, zone);
  const until = formatDate(end, locale, zone);
  if (from && until) return translate('boards.dateRange', { start: from, end: until });
  if (from) return translate('boards.dateFrom', { start: from });
  if (until) return translate('boards.dateUntil', { end: until });
  return translate('boards.noDate', {});
}
