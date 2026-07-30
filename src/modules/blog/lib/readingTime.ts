import { stripMarkdown } from "../components/ArticleCard";

/**
 * Estime le temps de lecture (en minutes) d'un corps markdown (~200 mots/min, minimum 1). Réutilise
 * `stripMarkdown` (retire la syntaxe pour compter les mots réels). Retourne 0 si vide.
 */
export function estimateReadingTime(markdown: string | undefined, wpm = 200): number {
  if (!markdown) return 0;
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;
  return words > 0 ? Math.max(1, Math.ceil(words / wpm)) : 0;
}
