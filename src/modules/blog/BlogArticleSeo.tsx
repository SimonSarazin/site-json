import { Helmet } from "@dr.pogodin/react-helmet";
import type { ArticleData } from "./hooks/useArticle";

/** SEO d'un article : title/description/OpenGraph + JSON-LD `BlogPosting`. `url` (absolu) = canonical/og:url. */
export function BlogArticleSeo({ article, url }: { article: ArticleData; url?: string }) {
  const title = article.name ?? "";
  const desc = article.shortDescription
    || (typeof article.description === "string" ? article.description.replace(/[#*_>`[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 160) : "");
  const image = article.profilImageUrl || article.profilMediumImageUrl;
  const created = typeof article.created === "number"
    ? new Date(article.created < 2e10 ? article.created * 1000 : article.created).toISOString()
    : undefined;
  const author = article.parent && typeof article.parent === "object"
    ? (Object.values(article.parent)[0]?.name as string | undefined)
    : undefined;

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    ...(desc ? { description: desc } : {}),
    ...(image ? { image } : {}),
    ...(created ? { datePublished: created } : {}),
    ...(author ? { author: { "@type": "Organization", name: author } } : {}),
    ...(url ? { mainEntityOfPage: url } : {}),
  };

  // Enfants en TABLEAU avec `key` + conditionnels `? … : null` (jamais `cond && …` qui, si `cond` est une
  // chaîne VIDE, produit `""` — un descendant string rejeté par Helmet). Pattern aligné sur Seo.tsx.
  return (
    <Helmet>
      {[
        <title key="title">{title || "Article"}</title>,
        desc ? <meta key="desc" name="description" content={desc} /> : null,
        <meta key="og-type" property="og:type" content="article" />,
        <meta key="og-title" property="og:title" content={title || "Article"} />,
        desc ? <meta key="og-desc" property="og:description" content={desc} /> : null,
        image ? <meta key="og-img" property="og:image" content={image} /> : null,
        url ? <meta key="og-url" property="og:url" content={url} /> : null,
        url ? <link key="canonical" rel="canonical" href={url} /> : null,
        <script key="ld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />,
      ]}
    </Helmet>
  );
}
export default BlogArticleSeo;
