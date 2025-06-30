// components/Seo.tsx
import { Helmet } from "@dr.pogodin/react-helmet";
import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/locale-schema";

interface SeoProps {
  page: {
    seo?: {
      title?: LocalizedString;
      description?: LocalizedString;
      keywords?: string[];
      ogImage?: string;
      ogType?: string;
      twitterCard?: string;
      canonical?: string;
      noIndex?: boolean;
      noFollow?: boolean;
      structuredData?: Record<string, unknown>;
    };
    title: LocalizedString;
  }; // <-- Page issue de config
}

export function Seo({ page }: SeoProps) {
  const { t, currentLocale } = useLocalization();
  const seo = page.seo ?? {};

  const title = seo.title ? t(seo.title) : t(page.title);
  const description = seo.description ? t(seo.description) : "";

  return (
    <Helmet htmlAttributes={{ lang: currentLocale }}>
      {/* Basiques */}
      <title>{title}</title>
      {description && <meta name="description" content={description} />}

      {/* Mots-clés */}
      {seo.keywords?.length && (
        <meta name="keywords" content={seo.keywords.join(", ")} />
      )}

      {/* OG / Twitter */}
      {seo.ogImage && <meta property="og:image" content={seo.ogImage} />}
      {seo.ogType && <meta property="og:type" content={seo.ogType} />}
      {seo.twitterCard && (
        <meta name="twitter:card" content={seo.twitterCard} />
      )}
      {seo.canonical && <link rel="canonical" href={seo.canonical} />}

      {/* Robots */}
      {(seo.noIndex || seo.noFollow) && (
        <meta
          name="robots"
          content={[
            seo.noIndex ? "noindex" : "index",
            seo.noFollow ? "nofollow" : "follow",
          ].join(",")}
        />
      )}

      {/* Structured data (JSON-LD) */}
      {seo.structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(seo.structuredData)}
        </script>
      )}
    </Helmet>
  );
}
