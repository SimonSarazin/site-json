import { formatDateLong } from "@/helpers/formatDate";

import type { ArticleData } from "../hooks/useArticle";

/**
 * Date ÉDITORIALE d'un article — point de vérité unique du module.
 *
 * `publicationDate` d'abord, `created` en repli. Les deux ne disent pas la même chose :
 * `created` est la date de SAISIE (posée par le backend), `publicationDate` la date que
 * l'éditeur revendique. Les sections `articleFeed` qui trient sur `publicationDate`
 * affichaient jusqu'ici `created` sur leurs cartes : une actualité datée du 1er septembre
 * mais saisie le 1er août sortait en tête du fil étiquetée « 1 août », au-dessus d'articles
 * étiquetés plus récents — l'ordre et les étiquettes se contredisaient à l'écran.
 *
 * ⚠️ `publicationDate` est un champ COSTUM : il n'est pas dans la projection publique par
 * défaut des POI. Sans `defaultFields` explicite dans la requête, il n'arrive PAS et le repli
 * sur `created` est silencieux — c'est pourquoi `ARTICLE_FIELDS` (constants/fields.ts) le
 * projette pour toutes les surfaces du module.
 *
 * Les sites qui ne posent pas de `publicationDate` gardent exactement le comportement
 * historique (repli sur `created`).
 */

/** Parse une date d'article : epoch secondes, epoch millisecondes, ou chaîne ISO. */
export function parseArticleDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  const d = Number.isFinite(n) ? new Date(n < 2e10 ? n * 1000 : n) : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Valeur brute de la date éditoriale (`publicationDate` sinon `created`), non formatée. */
export function articleDateValue(article: Pick<ArticleData, "created"> & { publicationDate?: unknown }): unknown {
  const pub = (article as { publicationDate?: unknown }).publicationDate;
  return pub == null || pub === "" ? article.created : pub;
}

/** Date éditoriale formatée pour l'affichage (`formatDateLong`), ou `null` si inexploitable. */
export function articleDate(article: Pick<ArticleData, "created"> & { publicationDate?: unknown }): string | null {
  const d = parseArticleDate(articleDateValue(article));
  return d ? formatDateLong(d) : null;
}
