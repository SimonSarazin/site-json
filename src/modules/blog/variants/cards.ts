import { makeVariantRegistry } from "./registry";
import type { ArticleCardProps } from "../components/ArticleCard";

/**
 * Registre des variants de CARTE d'article (lazy). Un déploiement choisit sa carte par config
 * (`articleFeed.props.cardVariant` / `config.blog.defaultCardVariant`) sans toucher au cœur. Ajouter un
 * variant = créer `components/ArticleCard<X>.tsx` (props `ArticleCardProps`, `export default`) + une entrée ici.
 */
export const CARD_VARIANTS = makeVariantRegistry<ArticleCardProps>({
  default: () => import("../components/ArticleCard"),
  compact: () => import("../components/ArticleCardCompact"),
});
