import { lazy } from "vite-preload";
import { makeVariantRegistry } from "./registry";
import type { ArticleCardProps } from "../components/ArticleCard";

/**
 * Registre des variants de CARTE d'article (lazy vite-preload). Un déploiement choisit sa carte par config
 * (`articleFeed.props.cardVariant` / `config.blog.defaultCardVariant`) sans toucher au cœur. Ajouter un
 * variant = créer `components/ArticleCard<X>.tsx` (props `ArticleCardProps`, `export default`) + une entrée
 * `lazy(() => import(...))` ici (import statique DIRECT → tracé par le plugin vite-preload).
 */
export const CARD_VARIANTS = makeVariantRegistry<ArticleCardProps>({
  default: lazy(() => import("../components/ArticleCard")),
  compact: lazy(() => import("../components/ArticleCardCompact")),
});
