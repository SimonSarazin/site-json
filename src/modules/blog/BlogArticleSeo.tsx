import { Helmet } from "@dr.pogodin/react-helmet";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { stripMarkdown } from "./lib/markdown";
import type { ArticleData } from "./hooks/useArticle";

/** created/updated (unix s ou ms) → ISO, tolérant. */
function toIso(v: unknown): string | undefined {
  if (typeof v !== "number") return undefined;
  const d = new Date(v < 2e10 ? v * 1000 : v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** SEO d'un article : title/description/OpenGraph + JSON-LD `BlogPosting` enrichi. `url` (absolu) = canonical/og:url. */
export function BlogArticleSeo({ article, url }: { article: ArticleData; url?: string }) {
  const t = useT("modules/blog");
  const { config } = useSite();

  const title = article.name ?? "";
  const bodyText = typeof article.description === "string" ? stripMarkdown(article.description) : "";
  const desc = article.shortDescription || (bodyText ? bodyText.slice(0, 160) : "");
  const image = article.profilImageUrl || article.profilMediumImageUrl;
  const created = toIso(article.created);
  const modified = toIso(article.updated);
  const author = article.parent && typeof article.parent === "object"
    ? (Object.values(article.parent)[0]?.name as string | undefined)
    : undefined;
  const keywords = Array.isArray(article.tags) && article.tags.length ? article.tags.join(", ") : undefined;
  const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
  // Nom du site = éditeur. config.meta.title peut être un LocalizedString → résolu par `t`.
  const publisherName = config.meta?.title ? t(config.meta.title as never) : undefined;

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    ...(desc ? { description: desc } : {}),
    ...(image ? { image } : {}),
    ...(created ? { datePublished: created } : {}),
    ...(modified ? { dateModified: modified } : {}),
    ...(author ? { author: { "@type": "Organization", name: author } } : {}),
    ...(publisherName ? { publisher: { "@type": "Organization", name: publisherName } } : {}),
    ...(keywords ? { keywords } : {}),
    ...(wordCount > 0 ? { wordCount } : {}),
    // articleBody = corps en texte brut (borné) → extraction de contenu par les moteurs / IA.
    ...(bodyText ? { articleBody: bodyText.slice(0, 5000) } : {}),
    ...(url ? { mainEntityOfPage: url } : {}),
  };

  // Helmet injecte en SSR title/meta/link (cf. entry-server `onShellReady`) MAIS PAS ses `<script>`. Le
  // JSON-LD est donc rendu en `<script>` DIRECT (dans l'arbre) → présent dans le HTML serveur (crawlers non-JS
  // / scrapers IA). Contenu déterministe (calculé de `article`) → pas de mismatch d'hydratation.
  // Enfants Helmet en TABLEAU + conditionnels `? … : null` (jamais `cond && …` : `""` = descendant rejeté).
  return (
    <>
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
          created ? <meta key="pub-time" property="article:published_time" content={created} /> : null,
          modified ? <meta key="mod-time" property="article:modified_time" content={modified} /> : null,
        ]}
      </Helmet>
      {/* Échapper `<` → `<` (JSON valide) : empêche un `</script>`/`<!--` dans articleBody (contenu
          admin/WP) de casser la balise en SSR = anti-XSS standard pour du JSON-LD inline rendu server-side. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    </>
  );
}
export default BlogArticleSeo;
