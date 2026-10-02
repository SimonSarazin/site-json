/**
 * Manipulations de texte du composer — pures, donc testables sans DOM ni frappe simulée.
 *
 * Chaque fonction reçoit l'état du champ (texte + sélection) et rend le nouvel état complet,
 * sélection comprise. C'est la seule façon de garantir que le curseur retombe au bon endroit :
 * une fonction qui ne rendrait que le texte laisserait le composant deviner, et il devinerait
 * faux dès que la marque est posée autour d'une sélection non vide.
 */

export interface FieldState {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

/** Les six marques révélées au focus. `wrap` entoure, `prefix` préfixe chaque ligne. */
export type MarkKind = "bold" | "italic" | "code" | "quote" | "list" | "link";

interface MarkSpec {
  readonly kind: "wrap" | "prefix";
  readonly before: string;
  readonly after?: string;
  /** Texte inséré quand rien n'est sélectionné, puis sélectionné pour être remplacé. */
}

const MARKS: Record<MarkKind, MarkSpec> = {
  bold: { kind: "wrap", before: "**", after: "**", },
  italic: { kind: "wrap", before: "*", after: "*", },
  code: { kind: "wrap", before: "`", after: "`", },
  link: { kind: "wrap", before: "[", after: "](url)", },
  quote: { kind: "prefix", before: "> ", },
  list: { kind: "prefix", before: "- ", },
};

export const MARK_KINDS = Object.keys(MARKS) as readonly MarkKind[];

/** Bornes de la ou des lignes touchées par la sélection. */
function lineBounds(text: string, start: number, end: number): { from: number; to: number } {
  const from = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf("\n", end);
  return { from, to: nextBreak === -1 ? text.length : nextBreak };
}

/**
 * Applique une marque markdown.
 *
 * Trois comportements, et le troisième est celui qu'on oublie :
 *   - sélection non vide → la marque l'entoure et la sélection reste sur le texte ;
 *   - sélection vide → un texte d'exemple est inséré **et sélectionné**, prêt à être remplacé ;
 *   - marque déjà présente autour de la sélection → elle est **retirée** (bascule).
 */
/**
 * `exemple` est le texte inséré quand rien n'est sélectionné — fourni TRADUIT par l'appelant :
 * les exemples vivaient ici, en français, et s'inséraient tels quels dans toutes les langues
 * (revue du 29/09).
 */
export function applyMark(state: FieldState, mark: MarkKind, exemple: string): FieldState {
  const spec = MARKS[mark];
  const { text, selectionStart: start, selectionEnd: end } = state;

  if (spec.kind === "prefix") {
    const { from, to } = lineBounds(text, start, end);
    const block = text.slice(from, to);
    const lines = block.split("\n");
    const alreadyMarked = lines.every(line => line.startsWith(spec.before));
    const next = lines
      .map(line => (alreadyMarked ? line.slice(spec.before.length) : spec.before + line))
      .join("\n");
    const delta = next.length - block.length;
    const body = block.length === 0 && !alreadyMarked ? spec.before + exemple : next;
    const rebuilt = text.slice(0, from) + body + text.slice(to);
    return block.length === 0 && !alreadyMarked
      ? { text: rebuilt, selectionStart: from + spec.before.length, selectionEnd: from + spec.before.length + exemple.length }
      : { text: rebuilt, selectionStart: start + (alreadyMarked ? -spec.before.length : spec.before.length), selectionEnd: end + delta };
  }

  const after = spec.after ?? spec.before;
  const before = spec.before;
  const selected = text.slice(start, end);

  // Bascule : la marque encadre déjà la sélection, on la retire.
  const hasBefore = text.slice(Math.max(0, start - before.length), start) === before;
  const hasAfter = text.slice(end, end + after.length) === after;
  if (selected.length > 0 && hasBefore && hasAfter) {
    const rebuilt = text.slice(0, start - before.length) + selected + text.slice(end + after.length);
    return { text: rebuilt, selectionStart: start - before.length, selectionEnd: end - before.length };
  }

  const body = selected.length > 0 ? selected : exemple;
  const rebuilt = text.slice(0, start) + before + body + after + text.slice(end);
  return {
    text: rebuilt,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + body.length,
  };
}

/** Insère un texte au curseur (émoji, saut de ligne…) et place le curseur juste après. */
export function insertAtCursor(state: FieldState, insert: string): FieldState {
  const { text, selectionStart: start, selectionEnd: end } = state;
  const rebuilt = text.slice(0, start) + insert + text.slice(end);
  const caret = start + insert.length;
  return { text: rebuilt, selectionStart: caret, selectionEnd: caret };
}

export interface MentionQuery {
  /** Position du `@`. */
  readonly start: number;
  /** Ce qui a été tapé après le `@`, sans le `@`. */
  readonly query: string;
}

/**
 * Le `@…` en cours de frappe, juste avant le curseur — ou `null`.
 *
 * Le `@` ne compte que s'il ouvre un mot : précédé d'un début de texte ou d'une espace. Sans
 * cette règle, une adresse e-mail tapée dans le message ouvrirait l'autocomplétion.
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const upToCaret = text.slice(0, caret);
  const at = upToCaret.lastIndexOf("@");
  if (at === -1) return null;

  const before = at === 0 ? "" : upToCaret.charAt(at - 1);
  if (before !== "" && !/\s/.test(before)) return null;

  const query = upToCaret.slice(at + 1);
  // Une espace ferme la recherche : on ne mentionne pas sur plusieurs mots.
  if (/\s/.test(query)) return null;
  return { start: at, query };
}

/** Remplace le `@…` en cours par le slug choisi, et laisse une espace derrière. */
export function replaceMentionQuery(
  state: FieldState,
  mention: MentionQuery,
  slug: string,
): FieldState {
  const inserted = `@${slug} `;
  const rebuilt = state.text.slice(0, mention.start) + inserted + state.text.slice(state.selectionStart);
  const caret = mention.start + inserted.length;
  return { text: rebuilt, selectionStart: caret, selectionEnd: caret };
}

/**
 * La touche Entrée envoie-t-elle le message ?
 *
 * Entrée envoie, Maj+Entrée passe à la ligne — la convention des messageries. Les combinaisons
 * avec Ctrl/Cmd/Alt sont laissées au navigateur (et à la composition de caractères accentués).
 */
export function shouldSubmitOnEnter(event: {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
}): boolean {
  if (event.key !== "Enter") return false;
  // Pendant une composition (saisie IME, accents), Entrée valide le caractère, pas le message.
  if (event.isComposing) return false;
  return !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
}
