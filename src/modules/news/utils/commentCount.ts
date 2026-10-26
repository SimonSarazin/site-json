import type { News } from "@communecter/cocolight-api-client";

/**
 * Reporte sur une actualité la variation du nombre de messages de son fil.
 *
 * C'est l'**adaptateur** entre le module `comment`, qui ne connaît que son propre cache, et le
 * compteur que `NewsItem` affiche. Le module générique annonce un delta (`onCountChange`) ;
 * c'est ici, et ici seulement, qu'on sait où ce delta doit atterrir.
 *
 * La mutation directe de `serverData` n'est pas une négligence : c'est un **Proxy réactif** du
 * SDK, et c'est précisément par cette écriture que `useReactiveProperty("commentCount")`
 * rafraîchit l'affichage. Remplacer l'objet romprait la réactivité au lieu de la déclencher.
 * La fonction vit hors composant pour que cette écriture assumée ne se confonde pas avec la
 * mutation d'une prop, que React interdit à juste titre.
 */
export function bumpCommentCount(news: News | null | undefined, delta: number): void {
  const data = news?.serverData as { commentCount?: unknown } | undefined;
  if (!data) return;
  const current = typeof data.commentCount === "number" ? data.commentCount : 0;
  // Jamais négatif : une suppression en cascade peut annoncer plus de messages que le
  // compteur n'en portait, si celui-ci était déjà désynchronisé.
  data.commentCount = Math.max(0, current + delta);
}
