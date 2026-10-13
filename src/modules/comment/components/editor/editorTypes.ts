import type { CommentMention } from "../../types";

/**
 * Ce que la coquille du composer et la zone éditable se disent — des types et une liste, rien de
 * l'éditeur : la coquille s'en sert sans le charger.
 */

/** Les mises en forme de la barre d'outils, dans l'ordre où elle les montre. */
export const FORMAT_KINDS = ["bold", "italic", "strike", "code", "link", "quote", "list", "ordered", "codeBlock"] as const;
export type FormatKind = (typeof FORMAT_KINDS)[number];

/** Ce que l'éditeur dit de lui à la coquille, à chaque fois que cela change. */
export interface EditorSurfaceState {
  /** Rien ne partirait : pas de texte, ou seulement des espaces et des sauts de ligne. */
  readonly empty: boolean;
  /** Les mises en forme actives au curseur. */
  readonly active: Readonly<Record<FormatKind, boolean>>;
}

/** Par où la coquille commande l'éditeur. */
export interface EditorSurfaceHandle {
  focus(): void;
  /** Bascule une mise en forme — sauf le lien, qui demande une adresse (`setLink`). */
  toggle(kind: FormatKind): void;
  /** L'adresse du lien au curseur, ou `null`. */
  currentLink(): string | null;
  /** Pose un lien sur la sélection (ou insère l'adresse) ; `null` le retire. */
  setLink(href: string | null): void;
  /** Insère un texte au curseur — un émoji. */
  insertText(text: string): void;
  /** Ce qui part : le markdown du message, espaces de bord coupés, et les personnes qu'il mentionne. */
  read(): { text: string; mentions: CommentMention[] };
  clear(): void;
}
