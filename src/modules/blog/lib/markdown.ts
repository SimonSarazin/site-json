/** Retire la syntaxe markdown pour un APERÇU / comptage en texte brut : liens/images/titres/emphase/code. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")      // images ![alt](url) → rien
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")    // liens [texte](url) → texte
    .replace(/^#{1,6}\s+/gm, "")                // titres
    .replace(/[*_`~>#]/g, "")                    // emphase/code/citation/reliquat
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
