/**
 * Fonction de traduction telle que retournée par `useT(namespace)` :
 * `(key, fallback?, interpolationParams?) => string`.
 */
type TFunction = (
  key: string,
  fallback?: string,
  interpolationParams?: Record<string, unknown>,
) => string;

/**
 * Convertit une `Date` en libellé relatif court ("il y a 5 min") en s'appuyant
 * sur les clés i18n du namespace `modules/notification` (time.*). Pur, testable.
 *
 * @param date  date de l'événement
 * @param t     fonction de traduction scopée `useT("modules/notification")`
 * @param now   timestamp de référence (ms) — injectable pour les tests
 */
export function formatTimeAgo(
  date: Date | null | undefined,
  t: TFunction,
  now: number = Date.now(),
): string {
  if (!date) return "";
  const diffMs = Math.max(0, now - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return t("time.now");
  if (minutes < 60) return t("time.minutesAgo", undefined, { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", undefined, { count: hours });

  const days = Math.floor(hours / 24);
  return t("time.daysAgo", undefined, { count: days });
}
