import "../i18n";
import { useT } from "@/hooks/useT";
import { useSite } from "@/hooks/useSite";
import { CARD_VARIANTS } from "../variants/cards";
import { useRelatedArticles } from "../hooks/useRelatedArticles";
import type { ArticleData } from "../hooks/useArticle";

/**
 * Bloc « Articles liés » (bas du reader) : articles partageant des tags avec l'article courant, même costum.
 * Île client (le hook est gaté `hydrated`) → n'affiche rien tant qu'aucun lié (ou sans tags).
 * Carte résolue via le registre `CARD_VARIANTS` (`config.blog.defaultCardVariant`), comme le fil.
 */
export function RelatedArticles({ article }: { article: ArticleData }) {
  const t = useT("modules/blog");
  const { config } = useSite();
  const Card = CARD_VARIANTS.get(config.blog?.defaultCardVariant);
  const { articles } = useRelatedArticles(article);
  if (!articles.length) return null;

  return (
    <section aria-label={t("article.related")} className="mx-auto mt-12 w-full max-w-3xl border-t px-4 pt-8">
      <h2 className="mb-6 text-xl font-bold text-foreground">{t("article.related")}</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {articles.map((a) => (
          <Card key={a.id} article={a} href={a.slug ? `/blog/${a.slug}` : `/blog/id/${a.id}`} />
        ))}
      </div>
    </section>
  );
}
export default RelatedArticles;
