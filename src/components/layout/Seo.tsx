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
      {[
      <title>{title}</title>,
      description && <meta name="description" content={description} />,
      seo.keywords && seo.keywords.length > 0 && (
        <meta name="keywords" content={seo.keywords.join(", ")} />
      ),
      seo.ogImage && seo.ogImage!=="" && <meta property="og:image" content={seo.ogImage} />,
      seo.ogType && seo.ogType!=="" && <meta property="og:type" content={seo.ogType} />,
      seo.twitterCard && seo.twitterCard !== "" && (
        <meta name="twitter:card" content={seo.twitterCard} />
      ),
      seo.canonical && seo.canonical !== "" && <link rel="canonical" href={seo.canonical} />,
      (seo.noIndex || seo.noFollow) && (
        <meta
          name="robots"
          content={[
            seo.noIndex ? "noindex" : "index",
            seo.noFollow ? "nofollow" : "follow",
          ].join(",")}
        />
      ),
      seo.structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(seo.structuredData)}
        </script>
      )
      ].filter(Boolean)}
    </Helmet>
  );
}
