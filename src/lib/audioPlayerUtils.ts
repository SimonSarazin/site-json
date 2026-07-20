/**
 * Fonctions pures du lecteur audio (AudioPlayer).
 * Séparées du composant pour être testables sans DOM.
 */

/** Vitesses de lecture proposées, dans l'ordre du cycle (1× → 1.25× → 1.5× → 2× → 1×). */
export const VITESSES_LECTURE = [1, 1.25, 1.5, 2] as const;

/** Borne une valeur entre min et max ; une valeur non finie (NaN, ±Infinity) retombe sur min. */
export function clamp(valeur: number, min: number, max: number): number {
  if (!Number.isFinite(valeur)) return min;
  return Math.min(Math.max(valeur, min), max);
}

/**
 * Formate une durée en secondes en "m:ss" (ou "h:mm:ss" au-delà d'une heure).
 * Les valeurs invalides (NaN, Infinity, négatives) retombent sur "0:00" car
 * `<audio>.duration` vaut NaN tant que les métadonnées ne sont pas chargées.
 */
export function formaterTemps(secondes: number): string {
  if (!Number.isFinite(secondes) || secondes < 0) return "0:00";
  const total = Math.floor(secondes);
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  if (heures > 0) return `${heures}:${String(minutes).padStart(2, "0")}:${s}`;
  return `${minutes}:${s}`;
}

/** Pourcentage de progression (0–100) ; 0 si la durée est inconnue ou invalide. */
export function calculerPourcentage(tempsCourant: number, duree: number): number {
  if (!Number.isFinite(duree) || duree <= 0) return 0;
  return clamp((tempsCourant / duree) * 100, 0, 100);
}

/** Vitesse suivante dans le cycle ; une vitesse hors liste repart sur 1×. */
export function vitesseSuivante(vitesse: number): number {
  const index = VITESSES_LECTURE.indexOf(vitesse as (typeof VITESSES_LECTURE)[number]);
  return VITESSES_LECTURE[(index + 1) % VITESSES_LECTURE.length];
}

/** Libellé d'affichage d'une vitesse de lecture (ex. "1×", "1.25×"). */
export function formaterVitesse(vitesse: number): string {
  return `${vitesse}×`;
}
