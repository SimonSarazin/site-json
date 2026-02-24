/**
 * Constantes pour les jours de la semaine
 * Format utilisé par l'API Cocolight pour les horaires d'ouverture
 */
export const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export type DayOfWeek = typeof DAYS[number];

interface OpeningHoursEntry {
  dayOfWeek: string;
  hours?: Array<{ opens: string; closes: string }>;
}

/**
 * Formatter pour normaliser les horaires d'ouverture
 * Garantit toujours 7 entrées (une par jour)
 */
export const widgetFormatters = {
  openingHours: (value: unknown) => {
    // Toujours 7 entrées Mo→Su
    const arr = Array.isArray(value) ? (value as OpeningHoursEntry[]) : [];
    return DAYS.map((day) => {
      const match = arr.find((o) => o.dayOfWeek === day);
      return match
        ? {
            dayOfWeek: day,
            hours: match.hours?.length
              ? [{ opens: match.hours[0].opens, closes: match.hours[0].closes }]
              : [],
          }
        : { dayOfWeek: day, hours: [] };
    });
  },
};
