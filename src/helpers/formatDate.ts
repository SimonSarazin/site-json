const FR_LOCALE = "fr-FR";

const toDate = (date: Date | string | number): Date =>
  date instanceof Date ? date : new Date(date);

/**
 * Parse TOLÉRANT → Date VALIDE ou `null` (Date | string ISO | number ; ignore vide/invalide).
 * Source unique du `toDate`-validant dupliqué dans les cards/previews de recherche (cf.
 * cartographie « toDate ×N »). NB : diffère du `toDate` local (non-validant, usage interne format*).
 */
export const toValidDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/** Date + heure, format long fr : « 14 juin 2026 03:19 ». */
export const formatDate = (date: Date | string | number) => {
  try {
    return toDate(date).toLocaleDateString(FR_LOCALE, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(date);
  }
};

/** Date SEULE, format long fr : « 14 juin 2026 » (sans heure). Source unique
 *  des sections Blog/Timeline (était dupliquée à l'identique dans chacune). */
export const formatDateLong = (date: Date | string | number) => {
  try {
    return toDate(date).toLocaleDateString(FR_LOCALE, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(date);
  }
};
