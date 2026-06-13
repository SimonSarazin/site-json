import type { useT } from "@/hooks/useT";

/**
 * Seuil en-dessous duquel une valeur est interprétée comme un timestamp en
 * secondes (format unix int côté serveur PHP) plutôt qu'en millisecondes
 * (format JS Date.now()).
 *
 * `1e12` correspond à un timestamp ms en l'an 2001. Toute valeur réaliste
 * en secondes (~1.7e9 aujourd'hui) tombe largement sous ce seuil ; toute
 * valeur réaliste en ms (~1.7e12) est au-dessus. La frontière est sûre
 * pour les ~30 prochaines années.
 */
const SECONDS_THRESHOLD_MS = 1e12;

/**
 * Formate une différence temporelle en chaîne lisible localisée.
 *
 * Granularité progressive :
 * - `< 1 minute` → "à l'instant"
 * - `< 1 heure`  → "il y a X minute(s)"
 * - `< 24h`      → "il y a X heure(s)"
 * - `< 30 jours` → "il y a X jour(s)"
 * - `≥ 30 jours` → composite "il y a Y an(s) Z mois et W jour(s)" (parties
 *   nulles omises, "et" devant la dernière)
 *
 * Les durées au-delà du mois utilisent une approximation usuelle :
 * 1 année = 365 jours, 1 mois = 30 jours. Suffisant pour de l'audit
 * humain (pas une précision astronomique).
 *
 * **Unité auto-détectée** : on accepte indifféremment des secondes (format
 * unix int côté serveur PHP) ou des millisecondes (Date.now() côté JS).
 * Si la valeur est sous `SECONDS_THRESHOLD_MS`, on la convertit en ms.
 *
 * Réutilisé par `DraftRecoveryBanner`, `AnswerActivityDialog`,
 * `MultiEvalChartDialog` — toutes les surfaces qui affichent un timestamp
 * relatif côté coform.
 *
 * @param timestamp Timestamp en secondes OU en millisecondes (auto-détecté).
 */
export function formatRelative(timestamp: number, t: ReturnType<typeof useT>): string {
  const timestampMs = timestamp < SECONDS_THRESHOLD_MS ? timestamp * 1000 : timestamp;
  const diffMs = Math.max(0, Date.now() - timestampMs);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("coform.draft.time.justNow");
  if (minutes < 60) return t("coform.draft.time.minutesAgo", undefined, { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("coform.draft.time.hoursAgo", undefined, { count: hours });

  const totalDays = Math.floor(hours / 24);
  if (totalDays < 30) return t("coform.draft.time.daysAgo", undefined, { count: totalDays });

  // ── Composite ≥ 30 jours : années + mois + jours ────────────────
  const years = Math.floor(totalDays / 365);
  const daysAfterYears = totalDays - years * 365;
  const months = Math.floor(daysAfterYears / 30);
  const days = daysAfterYears - months * 30;

  const parts: string[] = [];
  if (years > 0) parts.push(t("coform.draft.time.yearsPart", undefined, { count: years }));
  if (months > 0) parts.push(t("coform.draft.time.monthsPart", undefined, { count: months }));
  if (days > 0) parts.push(t("coform.draft.time.daysPart", undefined, { count: days }));

  // Edge case ultra-rare : tout pile sur des multiples (ex: 365 jours net).
  // On ré-injecte au moins l'unité la plus grosse pour ne jamais retourner
  // "il y a " tout court.
  if (parts.length === 0) {
    parts.push(t("coform.draft.time.daysPart", undefined, { count: totalDays }));
  }

  // Joindre : "et" devant la dernière partie quand il y en a plusieurs.
  // Ex: ["1 an", "2 mois", "5 jours"] → "1 an 2 mois et 5 jours".
  let joined: string;
  if (parts.length === 1) {
    joined = parts[0];
  } else {
    const last = parts[parts.length - 1];
    const head = parts.slice(0, -1).join(" ");
    const conj = t("coform.draft.time.conjAnd");
    joined = `${head} ${conj} ${last}`;
  }

  return t("coform.draft.time.agoPrefix", undefined, { value: joined });
}
