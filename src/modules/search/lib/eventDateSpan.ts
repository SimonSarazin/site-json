import { format, type Locale } from "date-fns";

/**
 * Forme d'affichage de la date d'un événement : un jour, ou une plage (avec ses deux bornes, pour que
 * l'appelant n'ait jamais à supposer qu'une fin existe).
 */
export type PorteeDate =
  | { kind: "jour" }
  /** `memeMois`/`memeAnnee` : quelles parties peuvent être tues sur la borne de gauche. */
  | { kind: "plage"; debut: Date; fin: Date; memeMois: boolean; memeAnnee: boolean };

const JOUR_MS = 24 * 60 * 60 * 1000;

const memeJour = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Un événement qui court sur plusieurs JOURS mérite ses deux bornes — « Mois de la parentalité »
 * s'affichait « 1 oct. 2026 » alors qu'il va jusqu'au 31.
 *
 * Reste « un jour » :
 *  - une fin le JOUR MÊME (le cas de la plupart des créneaux) ;
 *  - un créneau de moins de 24 h qui franchit minuit (`21:00` → `01:00`) : `closingTimeOnDay`
 *    (`agenda/lib/eventDates.ts`) reporte sa fin au lendemain pour que « En cours » reste atteignable,
 *    pas parce que l'événement dure deux jours — il n'a pas à se lire « 16 – 17 septembre » ;
 *  - une fin ANTÉRIEURE au début (donnée incohérente), traitée comme absente.
 */
export function porteeDate(debut: Date | null, fin: Date | null): PorteeDate {
  if (!debut || !fin) return { kind: "jour" };
  const duree = fin.getTime() - debut.getTime();
  if (duree < 0 || memeJour(debut, fin) || duree < JOUR_MS) return { kind: "jour" };
  return {
    kind: "plage",
    debut,
    fin,
    memeMois: debut.getFullYear() === fin.getFullYear() && debut.getMonth() === fin.getMonth(),
    memeAnnee: debut.getFullYear() === fin.getFullYear(),
  };
}

/**
 * Les deux lignes du bloc date d'une carte : `grand` (le ou les jours) et `petit` (mois et année de la
 * borne de DROITE). Sur une plage, la borne de gauche tait ce que la droite répète — mois et année
 * s'ils sont communs — pour ne pas doubler l'information : « 1 – 31 » / « oct. 2026 ».
 * La locale est passée en argument : la fonction reste pure et testable sans monter de composant.
 */
export function libellesDate(debut: Date, fin: Date | null, locale: Locale): { grand: string; petit: string } {
  const portee = porteeDate(debut, fin);
  if (portee.kind === "jour") {
    return { grand: format(debut, "d", { locale }), petit: format(debut, "LLL yyyy", { locale }) };
  }
  const gauche = portee.memeMois
    ? format(portee.debut, "d", { locale })
    : portee.memeAnnee
      ? format(portee.debut, "d LLL", { locale })
      : format(portee.debut, "d LLL yyyy", { locale });
  return {
    grand: `${gauche} – ${format(portee.fin, "d", { locale })}`,
    petit: format(portee.fin, "LLL yyyy", { locale }),
  };
}
