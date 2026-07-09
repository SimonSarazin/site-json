import { useParams, Link } from "react-router";
import "../i18n";
import { useT } from "@/hooks/useT";
import { Skeleton } from "@/components/ui/skeleton";
import { useArticle } from "../hooks/useArticle";
import { ArticleReader } from "../components/ArticleReader";
import { BlogArticleSeo } from "../BlogArticleSeo";

/** Page reader d'un article — route `/blog/:slug` (SSR) ou `/blog/id/:id` (slugless, ~82%). */
export default function ArticlePage() {
  const t = useT("modules/blog");
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const { article, isLoading, isError } = useArticle({ slug, id });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError || !article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        {t("article.notFound")} · <Link to="/blog" className="text-primary underline">{t("article.backToList")}</Link>
      </div>
    );
  }
  // Canonical/og:url (aligné ProfileSeo : origine côté client). Priorité au slug → un article slugué
  // ouvert via /blog/id/:id canonicalise vers /blog/:slug (évite le duplicate content).
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const path = article.slug ? `/blog/${article.slug}` : id ? `/blog/id/${id}` : slug ? `/blog/${slug}` : "";
  const canonicalUrl = origin && path ? origin + path : undefined;

  return (
    <>
      <BlogArticleSeo article={article} url={canonicalUrl} />
      <ArticleReader article={article} />
    </>
  );
}
