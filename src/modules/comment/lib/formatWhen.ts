/**
 * Formatage des repères temporels du fil.
 *
 * Pur et sans dépendance à `date-fns` : ces fonctions reçoivent la locale BCP-47 et, pour les
 * comparaisons, un « maintenant » injectable. C'est ce qui rend les séparateurs de jour
 * testables sans geler l'horloge, et ce qui garantit que le fil, le panneau et l'aperçu
 * disent la même chose du même instant.
 *
 * Toutes les entrées sont des timestamps UNIX en **secondes** — la forme que `commentTree`
 * garantit en sortie, quelle que soit la forme reçue du serveur.
 */

/** Clé de jour local (AAAA-MM-JJ), qui sert à décider d'un changement de date. */
export function dayKeyOf(unixSeconds: number, timeZone?: string): string {
  const d = new Date(unixSeconds * 1000);
  if (!timeZone) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  // `en-CA` rend nativement AAAA-MM-JJ : aucune partie à réordonner.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export interface WhenOptions {
  readonly locale?: string;
  readonly timeZone?: string;
  /** Instant de référence, en secondes UNIX. Injectable pour les tests. */
  readonly now?: number;
}

/** L'heure seule : « 14:32 ». C'est ce qu'affiche une ligne groupée, dans sa gouttière. */
export function formatTimeOfDay(unixSeconds: number, options: WhenOptions = {}): string {
  return new Intl.DateTimeFormat(options.locale ?? "fr", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: options.timeZone,
  }).format(new Date(unixSeconds * 1000));
}

/** Date complète et heure : sert aux infobulles et aux libellés d'accessibilité. */
export function formatFullWhen(unixSeconds: number, options: WhenOptions = {}): string {
  return new Intl.DateTimeFormat(options.locale ?? "fr", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: options.timeZone,
  }).format(new Date(unixSeconds * 1000));
}

/** Écart en jours **calendaires** (et non en tranches de 24 h) entre deux instants. */
export function calendarDaysBetween(unixSeconds: number, options: WhenOptions = {}): number {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const a = dayKeyOf(unixSeconds, options.timeZone);
  const b = dayKeyOf(now, options.timeZone);
  if (a === b) return 0;
  // La comparaison se fait sur les clés de jour, puis en millisecondes, pour ignorer l'heure :
  // hier 23 h 50 et aujourd'hui 0 h 10 sont à un jour d'écart, pas à zéro.
  const toUtc = (key: string) => Date.parse(`${key}T00:00:00Z`);
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/**
 * Libellé d'un séparateur de jour.
 *
 * Rend `"today"` ou `"yesterday"` — au composant de les traduire — ou une date déjà formatée.
 * Retourner une clé plutôt qu'un texte évite d'avoir à passer `t` dans une fonction pure.
 */
export function daySeparatorLabel(
  unixSeconds: number,
  options: WhenOptions = {},
): { readonly key: "today" | "yesterday" } | { readonly key: null; readonly text: string } {
  const gap = calendarDaysBetween(unixSeconds, options);
  if (gap === 0) return { key: "today" };
  if (gap === 1) return { key: "yesterday" };
  return {
    key: null,
    text: new Intl.DateTimeFormat(options.locale ?? "fr", {
      day: "numeric",
      month: "long",
      // L'année n'apparaît que si elle diffère de l'année courante : la répéter sur tout un
      // fil récent est du bruit.
      year: sameYear(unixSeconds, options) ? undefined : "numeric",
      timeZone: options.timeZone,
    }).format(new Date(unixSeconds * 1000)),
  };
}

function sameYear(unixSeconds: number, options: WhenOptions): boolean {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  return dayKeyOf(unixSeconds, options.timeZone).slice(0, 4) === dayKeyOf(now, options.timeZone).slice(0, 4);
}

/**
 * Repère compact pour une LISTE (rail, colonne de fils), où la place manque.
 *
 * Aujourd'hui → l'heure ; hier → une clé à traduire ; au-delà → la date courte. C'est la
 * même règle que le séparateur de jour du fil, resserrée : les deux vues disent ainsi la
 * même chose du même instant, ce qui évite qu'un fil « d'hier » dans la colonne s'ouvre sur
 * un séparateur « aujourd'hui ».
 */
export function compactWhen(
  unixSeconds: number,
  options: WhenOptions = {},
): { readonly key: "yesterday" } | { readonly key: null; readonly text: string } {
  const gap = calendarDaysBetween(unixSeconds, options);
  if (gap === 0) return { key: null, text: formatTimeOfDay(unixSeconds, options) };
  if (gap === 1) return { key: "yesterday" };
  return {
    key: null,
    text: new Intl.DateTimeFormat(options.locale ?? "fr", {
      day: "numeric",
      month: "short",
      year: sameYear(unixSeconds, options) ? undefined : "2-digit",
      timeZone: options.timeZone,
    }).format(new Date(unixSeconds * 1000)),
  };
}

/**
 * Le repère de fraîcheur d'une branche repliée : « aujourd'hui à 11:08 », « hier à 14:02 »,
 * « le 23 sept. ».
 *
 * Rend une clé et ses paramètres, comme `daySeparatorLabel` : le composant traduit, et la
 * fonction reste pure. Au-delà d'hier, l'heure disparaît — sur une branche vieille de trois
 * jours, c'est le jour qu'on cherche, pas la minute.
 */
export function freshnessOf(
  unixSeconds: number,
  options: WhenOptions = {},
):
  | { readonly key: "todayAt" | "yesterdayAt"; readonly time: string }
  | { readonly key: "onDate"; readonly date: string } {
  const gap = calendarDaysBetween(unixSeconds, options);
  if (gap === 0) return { key: "todayAt", time: formatTimeOfDay(unixSeconds, options) };
  if (gap === 1) return { key: "yesterdayAt", time: formatTimeOfDay(unixSeconds, options) };
  const compact = compactWhen(unixSeconds, options);
  return { key: "onDate", date: compact.key === null ? compact.text : "" };
}
