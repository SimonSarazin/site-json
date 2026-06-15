const FR_LOCALE = "fr-FR";

const toDate = (date: Date | string | number): Date =>
  date instanceof Date ? date : new Date(date);

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
