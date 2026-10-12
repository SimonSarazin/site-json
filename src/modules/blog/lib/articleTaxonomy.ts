import type { ArticleData } from "../hooks/useArticle";

/** Filtre un tableau potentiellement hétérogène (donnée backend non garantie) aux seules chaînes. */
export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Badges de taxonomie pour une CARTE d'article (fil, liste) : territoires et publics (listes courtes,
 * contrôlées par énumération — 9 valeurs chez parent62, donc jamais tronquées) suivis des mots-clés
 * (texte libre, potentiellement nombreux — plafonnés à `tagsMax` pour borner la hauteur de la carte).
 * Absents (site sans `territoires`/`publics` sur son POI), ils ne contribuent rien : rendu historique
 * (mots-clés seuls) inchangé pour les sites qui n'ont que des `tags`.
 */
export function cardTaxonomyBadges(article: ArticleData, tagsMax = 3): string[] {
  return [
    ...stringArray(article.territoires),
    ...stringArray(article.publics),
    ...stringArray(article.tags).slice(0, tagsMax),
  ];
}
