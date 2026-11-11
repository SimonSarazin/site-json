/**
 * Point de priorite de la carte — table UNIQUE, hors de tout fichier de composant : un fichier
 * de composant qui exporte une constante casse le Fast Refresh
 * (`react-refresh/only-export-components`).
 *
 * Basse VERT, moyenne BLEU, haute ORANGE, urgente ROUGE (DESIGN §1 de co-kanban) : ces teintes
 * disent un sens fixe, pas la marque du site, et restent donc celles de co-kanban
 * (`--ck-prio-*` de `styles.css`).
 */
import type { Priority } from '@/modules/kanban/types';

/**
 * ENCRE de couleur vive (>= 3:1 sur la carte). Le glyphe est un SVG trace en `currentColor` :
 * seule la couleur du texte compte.
 */
export const PRIORITY_DOT_CLASS: Record<Priority, string> = {
  low: 'text-[var(--ck-prio-low)]',
  medium: 'text-[var(--ck-prio-medium)]',
  high: 'text-[var(--ck-prio-high)]',
  urgent: 'text-[var(--ck-prio-urgent)]',
};

/** Silhouettes du point de priorite. */
export type PriorityDotShape = 'ring' | 'dot' | 'target' | 'diamond';

/**
 * FORME de chaque niveau — quatre silhouettes DISTINCTES, lisibles sans la
 * couleur (WCAG 1.4.1, DESIGN §7), qui « se remplissent » avec l'urgence :
 * anneau vide, point plein, point cercle, puis le losange — la seule forme a
 * angles, et la plus grande. « Haute » et « Urgente » partageaient le point
 * cercle : seule la teinte les distinguait, et une personne deuteranope ne
 * reperait plus les cartes urgentes.
 */
export const PRIORITY_DOT_SHAPE: Record<Priority, PriorityDotShape> = {
  low: 'ring',
  medium: 'dot',
  high: 'target',
  urgent: 'diamond',
};
