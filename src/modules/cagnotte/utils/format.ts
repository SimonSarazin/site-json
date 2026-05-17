/**
 * Helpers de formatage locale-aware pour le module cagnotte.
 *
 * Utilise `i18n.language` pour respecter la locale active de l'utilisateur
 * (FR/EN) au lieu d'une locale hardcodée comme `'fr-FR'`.
 */
import i18n from "@/i18n";

/**
 * Formate une valeur numérique en montant euros via `Intl.NumberFormat` (locale-aware).
 * Pas de décimales par défaut — les montants cagnotte sont stockés en euros entiers.
 *
 * @example
 *   formatCurrency(1234) // "1 234 €" en fr, "€1,234" en en
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(i18n.language, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Retourne les initiales d'un nom (max 2 lettres, majuscules) pour un avatar fallback.
 *
 * @example
 *   initials("Jean Dupont")    // "JD"
 *   initials("alice")          // "A"
 *   initials("Pôle Emploi 974") // "PE"
 */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Formate une date (timestamp ms ou string ISO) au format jour mois année (court).
 *
 * @example
 *   formatDate(1715680800000) // "14 mai 2024" en fr, "May 14, 2024" en en
 */
export function formatDate(value: number | string): string {
  return new Date(value).toLocaleDateString(i18n.language, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formate un nombre (sans devise) selon la locale active.
 *
 * @example
 *   formatNumber(1234567) // "1 234 567" en fr, "1,234,567" en en
 */
export function formatNumber(value: number): string {
  return value.toLocaleString(i18n.language);
}
