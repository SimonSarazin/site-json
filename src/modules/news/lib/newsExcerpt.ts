/**
 * Convertit le corps markdown d'une news en texte brut, pour un extrait de carte.
 *
 * Le champ `text` d'une news est du MARKDOWN (rendu via ReactMarkdown + remarkGfm + mentions
 * dans `NewsContent`). Affiché tel quel dans une carte, la syntaxe fuit : `**gras**`, `[lien](url)`,
 * `## titre`, images, code… On dérive donc un aperçu lisible sur une seule coulée de texte.
 *
 * Pur (testable), SANS dépendance de rendu : on ne charge pas un parseur markdown complet pour
 * un simple extrait. La troncature visuelle finale reste au CSS (`line-clamp`) ; `maxLength`
 * n'est qu'un garde-fou pour ne pas propager un corps de plusieurs Ko.
 */
export function newsExcerpt(input: unknown, maxLength = 240): string {
  if (typeof input !== "string" || input.length === 0) return "";
  let s = input;

  s = s.replace(/```[\s\S]*?```/g, " ");            // blocs de code clôturés → retirés
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");        // images ![alt](url) → retirées
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");       // liens [texte](url) → texte
  s = s.replace(/`([^`]+)`/g, "$1");                   // code inline `code` → code
  s = s.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, ""); // titres / citations / puces en début de ligne
  s = s.replace(/(\*\*|__|\*|_|~~)/g, "");             // emphase / barré
  s = s.replace(/<[^>]+>/g, " ");                       // balises HTML résiduelles
  s = s.replace(/\s+/g, " ").trim();                   // espaces (dont sauts de ligne) compactés

  if (s.length <= maxLength) return s;
  // Coupe au dernier espace avant la limite pour ne pas trancher un mot ; le « … » est laissé
  // au CSS line-clamp (qui tronquera de toute façon bien avant sur une carte étroite).
  const cut = s.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}
