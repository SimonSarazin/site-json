import { boardFlow, type FlowSegment } from "@/modules/kanban/lib/boardFlow";
import type { Column } from "@/modules/kanban/types";

/*
 * Teintes des colonnes ouvertes, de l'amont à l'aval : la couleur primaire du site, de plus en
 * plus soutenue à mesure que les cartes avancent. La colonne de fin prend le vert de réussite du
 * module (`styles.css` ; le `--success` du site est une teinte de fond), ADOUCI : sur un tableau
 * mûr elle tient l'essentiel du flux de `/kanban`, et en plein vert elle éclipsait le travail
 * ouvert. Classes écrites en toutes lettres : Tailwind ne génère que ce qu'il lit dans le source.
 *
 * La MÊME teinte nomme une colonne partout : bande du flux sur `/kanban`, point devant son titre
 * dans les vues Liste, Chronologie et Vue d'ensemble. Elle reste décorative : le titre est écrit.
 */
export const OPEN_TONES = ["bg-primary/45", "bg-primary/60", "bg-primary/75", "bg-primary/90", "bg-primary"] as const;
export const DONE_TONE = "bg-[var(--ck-success-ink)]/40";

export function flowToneClass(segment: FlowSegment): string | undefined {
  return segment.tone === null ? DONE_TONE : OPEN_TONES[segment.tone];
}

/** Teinte de chaque colonne d'un tableau (clé : id de colonne), rang compté sur les colonnes ouvertes. */
export function columnToneClasses(columns: readonly Column[]): ReadonlyMap<string, string> {
  const tones = new Map<string, string>();
  for (const segment of boardFlow(columns, OPEN_TONES.length)) tones.set(segment.column._id, flowToneClass(segment) ?? OPEN_TONES[0]);
  return tones;
}
