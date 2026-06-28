import { EVENT_TYPES } from "@communecter/cocolight-api-client";

/** Palette cyclée (1 couleur saturée par type d'event) pour les pastilles de la grille calendrier.
 *  Couleurs lisibles en clair ET sombre (pastille/point), le texte reste sur nos tokens (foreground). */
const PALETTE = ["#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444", "#64748b"];

const TYPE_COLOR: Record<string, string> = Object.fromEntries(
  [...EVENT_TYPES, "others"].map((t, i) => [String(t), PALETTE[i % PALETTE.length]]),
);

/** Couleur (pastille) d'un type d'event — repli sur « others ». */
export function eventTypeColor(type: string | undefined): string {
  return (type && TYPE_COLOR[type]) || TYPE_COLOR.others;
}
