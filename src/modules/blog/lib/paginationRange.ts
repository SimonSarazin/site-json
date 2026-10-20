/**
 * Liste des boutons à afficher pour la pagination numérotée (`articleFeed.pagination:"pages"`) —
 * un fil navigué page après page (le curseur backend interdit tout saut, cf. `usePagedFeedNav`)
 * accumule des pages déjà chargées sans plafond : à 30+ boutons, la rangée passait à la ligne sur
 * mobile comme sur desktop. Tronque en gardant la première page, la dernière, et une fenêtre autour
 * de la page courante — `"ellipsis"` comble les trous, jamais un bouton de plus que nécessaire.
 */
export type PageRangeItem = number | "ellipsis";

/**
 * `pageIndex`/`pageCount` : 0-indexés, mêmes conventions que `usePagedFeedNav`. `siblingCount` :
 * pages voisines affichées de part et d'autre de la page courante (1 = fenêtre de 3 pages).
 */
export function buildPageRange(pageCount: number, pageIndex: number, siblingCount = 1): PageRangeItem[] {
  const firstPageIndex = 0;
  const lastPageIndex = pageCount - 1;
  // Première + dernière + courante + 2 ellipses + les voisines de chaque côté — en-deçà, tout tient
  // sans troncature, un "..." remplaçant une seule page serait plus large que la page elle-même.
  const totalVisible = siblingCount * 2 + 5;
  if (pageCount <= totalVisible) {
    return Array.from({ length: pageCount }, (_, i) => i);
  }

  const leftSiblingIndex = Math.max(pageIndex - siblingCount, firstPageIndex);
  const rightSiblingIndex = Math.min(pageIndex + siblingCount, lastPageIndex);
  // Pas d'ellipse pour masquer UNE SEULE page : elle prendrait plus de place que la page affichée.
  const showLeftEllipsis = leftSiblingIndex > firstPageIndex + 2;
  const showRightEllipsis = rightSiblingIndex < lastPageIndex - 2;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => firstPageIndex + i);
    return [...leftRange, "ellipsis", lastPageIndex];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + siblingCount * 2;
    const rightRange = Array.from({ length: rightCount }, (_, i) => lastPageIndex - rightCount + 1 + i);
    return [firstPageIndex, "ellipsis", ...rightRange];
  }
  const middleRange = Array.from(
    { length: rightSiblingIndex - leftSiblingIndex + 1 },
    (_, i) => leftSiblingIndex + i,
  );
  return [firstPageIndex, "ellipsis", ...middleRange, "ellipsis", lastPageIndex];
}
