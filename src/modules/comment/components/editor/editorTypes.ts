import type { CommentMention } from "../../types";

/**
 * Ce que la coquille du composer et la zone éditable se disent — des types et une liste, rien de
 * l'éditeur : la coquille s'en sert sans le charger.
 */

/** Les mises en forme de la barre d'outils, dans l'ordre où elle les montre. */
export const FORMAT_KINDS = ["bold", "italic", "strike", "code", "link", "quote", "list", "ordered", "codeBlock"] as const;
export type FormatKind = (typeof FORMAT_KINDS)[number];

/** Les niveaux de titre : les six du markdown — ceux que propose l'éditeur du legacy. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

/**
 * Une image à poser DANS le texte : `src` est l'adresse ÉCRITE — le chemin relatif d'un fichier
 * importé (`/upload/…`), ou l'adresse d'un autre site. `alt` la décrit à qui ne la voit pas.
 */
export interface InlineImage {
  readonly src: string;
  readonly alt: string;
}

/** Ce que l'éditeur dit de lui à la coquille, à chaque fois que cela change. */
export interface EditorSurfaceState {
  /** Rien ne partirait : pas de texte, ou seulement des espaces et des sauts de ligne. */
  readonly empty: boolean;
  /** Les mises en forme actives au curseur. */
  readonly active: Readonly<Record<FormatKind, boolean>>;
  /** Le niveau du titre au curseur, ou `null` : un paragraphe, une liste, du code… */
  readonly heading: HeadingLevel | null;
  /** Le bloc au curseur peut-il devenir un titre ? Pas la première ligne d'un élément de liste. */
  readonly canHeading: boolean;
}

/** Par où la coquille commande l'éditeur. */
export interface EditorSurfaceHandle {
  focus(): void;
  /** Bascule une mise en forme — sauf le lien, qui demande une adresse (`setLink`). */
  toggle(kind: FormatKind): void;
  /** Fait du bloc au curseur un titre de ce niveau — ou, `null`, du texte normal. */
  setHeading(level: HeadingLevel | null): void;
  /** L'adresse du lien au curseur, ou `null`. */
  currentLink(): string | null;
  /** Pose un lien sur la sélection (ou insère l'adresse) ; `null` le retire. */
  setLink(href: string | null): void;
  /** Insère un texte au curseur — un émoji. */
  insertText(text: string): void;
  /** Pose une image dans le texte, au curseur (`![alt](src)` à l'enregistrement). */
  insertImage(image: InlineImage): void;
  /** Ce qui part : le markdown du message, espaces de bord coupés, et les personnes qu'il mentionne. */
  read(): { text: string; mentions: CommentMention[] };
  clear(): void;
}
