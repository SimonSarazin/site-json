import { lazy } from "vite-preload";
import { makeVariantRegistry } from "./registry";
import type { ArticleData } from "../hooks/useArticle";

/** Props communes à tous les variants de reader (registre `READER_VARIANTS`). */
export interface ArticleReaderProps {
  article: ArticleData;
  backTo?: string;
  /** Masquer le lien « Retour aux articles » (ex. section `articleReader` embarquée sur une page). */
  hideBack?: boolean;
  /** Balise du titre : `h1` (route reader, défaut) ou `h2` (section embarquée, évite un 2ᵉ h1 sur la page). */
  titleAs?: "h1" | "h2";
}

/**
 * Registre des variants de READER d'article (lazy vite-preload). Choisi au niveau site
 * (`config.blog.readerVariant`), lu par `ArticlePage`/`ArticleReaderSection`. Ajouter un variant = créer
 * `components/ArticleReader<X>.tsx` (props `ArticleReaderProps`, `export default`) + une entrée
 * `lazy(() => import(...))` ici. Seul `default` (le reader éditorial) est fourni pour l'instant.
 */
export const READER_VARIANTS = makeVariantRegistry<ArticleReaderProps>({
  default: lazy(() => import("../components/ArticleReader")),
  /** Affiches/flyers : couverture entière (ratio naturel), pas de recadrage 16/9. */
  poster: lazy(() => import("../components/ArticleReaderPoster")),
});
