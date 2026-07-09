import { makeVariantRegistry } from "./registry";
import type { ArticleData } from "../hooks/useArticle";

/** Props communes à tous les variants de reader (registre `READER_VARIANTS`). */
export interface ArticleReaderProps {
  article: ArticleData;
  backTo?: string;
  /** Masquer le lien « Retour aux articles » (ex. section `articleReader` embarquée sur une page). */
  hideBack?: boolean;
}

/**
 * Registre des variants de READER d'article (lazy). Choisi au niveau site (`config.blog.readerVariant`), lu
 * par `ArticlePage`. Ajouter un variant = créer `components/ArticleReader<X>.tsx` (props `ArticleReaderProps`,
 * `export default`) + une entrée ici. Seul `default` (le reader éditorial) est fourni pour l'instant.
 */
export const READER_VARIANTS = makeVariantRegistry<ArticleReaderProps>({
  default: () => import("../components/ArticleReader"),
});
