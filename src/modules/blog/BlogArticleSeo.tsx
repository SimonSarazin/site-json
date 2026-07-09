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

  return (
    <Helmet>
      <title>{title}</title>
      {desc && <meta name="description" content={desc} />}
      <meta property="og:type" content="article" />
      <meta property="og:title" content={title} />
      {desc && <meta property="og:description" content={desc} />}
      {image && <meta property="og:image" content={image} />}
      {url && <meta property="og:url" content={url} />}
      {url && <link rel="canonical" href={url} />}
      {/* JSON-LD : dangerouslySetInnerHTML (Helmet refuse un enfant string dans <script>) — cf. ProfileSeo. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </Helmet>
  );
}
export default BlogArticleSeo;
