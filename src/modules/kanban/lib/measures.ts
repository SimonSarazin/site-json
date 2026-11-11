/**
 * Montant et temps passe d'une action Communecter (§11.4) — logique PURE.
 *
 * `credits` est un nombre (le defaut serveur vaut 1), `timeSpent` des MINUTES
 * entieres. Ces helpers servent la modale de carte (saisie, lecture seule) et
 * les cartes du tableau (`CardPreview`) : une seule maniere d'ecrire
 * « 2 h 30 min ».
 */
import type { DateLocale } from '@/modules/kanban/lib/dates';

const MINUTES_PER_HOUR = 60;

/**
 * Duree lisible : « 45 min », « 2 h », « 2 h 30 min ».
 *
 * Les symboles `h` et `min` sont ceux du Systeme international, compris dans
 * les deux langues du projet : une seule ecriture evite deux catalogues pour
 * un format numerique. Chaine vide quand rien n'est renseigne.
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) return '';
  const total = Math.round(minutes);
  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const rest = total % MINUTES_PER_HOUR;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

const amountFormatters = new Map<DateLocale, Intl.NumberFormat>();

/** Montant formate a la langue (« 12,5 » / « 12.5 »), chaine vide si absent. */
export function formatAmount(value: number | null | undefined, locale: DateLocale): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  let formatter = amountFormatters.get(locale);
  if (!formatter) {
    // Un formateur par langue, pas par carte : `Intl.NumberFormat` coute cher.
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    amountFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

/**
 * Valeur d'un champ numerique : `null` pour un champ vide ou illisible.
 *
 * Un `<input type="number">` rend deja `''` pour une saisie qu'il ne sait pas
 * lire ; la virgule est acceptee pour les saisies collees depuis un tableur
 * francais.
 */
export function parseNumberInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/**
 * Plafonds du montant et du temps passe (`CardBranch::MAX_CREDITS`,
 * `MAX_TIME_SPENT`) : au-dela, c'est une faute de frappe, que le serveur refuse.
 */
export const CREDITS_MAX = 100_000;
export const TIME_SPENT_MAX = 100_000;

/** Montant acceptable : absent, ou un nombre positif ou nul, sous le plafond. */
export function isValidAmount(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0 && value <= CREDITS_MAX);
}

/** Temps passe acceptable : absent, ou un nombre ENTIER de minutes positif ou nul, sous le plafond. */
export function isValidMinutes(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 0 && value <= TIME_SPENT_MAX);
}
