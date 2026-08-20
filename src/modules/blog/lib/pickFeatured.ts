import type { ArticleData } from "./articleLink";

/**
 * Sélection de la une + du fil selon le mode `featured` d'`articleFeed` (pure, testée) :
 *  - `false`/absent → pas de une, le fil tel quel ;
 *  - `true`         → la une = le PLUS RÉCENT (items[0], comportement historique) ;
 *  - `"flag"`       → la une = l'ÉPINGLÉE (fiche `featured:true`, micro-requête serveur),
 *                     REPLI sur le plus récent si aucune ; le fil déduplique la une PAR ID —
 *                     où qu'elle vive dans les pages (jamais d'exclusion serveur : un article
 *                     ne peut pas disparaître, décision review MR 44 option B).
 */
export function pickFeatured(
  items: ArticleData[],
  pinned: ArticleData | undefined,
  mode: boolean | "flag" | undefined,
): { hero: ArticleData | undefined; rest: ArticleData[] } {
  if (!mode) return { hero: undefined, rest: items };
  const hero = mode === "flag" ? (pinned ?? items[0]) : items[0];
  if (!hero) return { hero: undefined, rest: items };
  return { hero, rest: items.filter((a) => a.id !== hero.id) };
}
