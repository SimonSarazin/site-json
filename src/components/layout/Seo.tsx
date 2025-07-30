// components/Seo.tsx
import { Helmet } from "@dr.pogodin/react-helmet";
import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/locale-schema";
import { useSite } from "@/contexts/SiteContext";

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
  const { config } = useSite();

  /** 1. Raccourcis vers les deux sources possibles */
  const seo   = page.seo ?? {};
  const meta  = config.meta ?? {};

  /** 2. Fusion des valeurs (page > site > fallback vide) */
  const title       = seo.title        ? t(seo.title)
                    : meta.title       ? t(meta.title)
                    : t(page.title);

  const description = seo.description  ? t(seo.description)
                    : meta.description ? t(meta.description)
                    : "";

  const keywords    = seo.keywords?.length ? seo.keywords
                    : meta.keywords?.length ? meta.keywords
                    : [];

  /** 3. Robots : on combine si besoin */
  let robots: string | undefined;
  if (seo.noIndex || seo.noFollow) {
    robots = [
      seo.noIndex  ? "noindex" : "index",
      seo.noFollow ? "nofollow" : "follow",
    ].join(",");
  } else if (meta.robots) {
    robots = meta.robots;
  }

  return (
    <Helmet htmlAttributes={{ lang: currentLocale }}>
      {[
        /* --- Basique ------------------------------------------------------ */
        <title key="title">{title}</title>,
        description && (
          <meta key="desc" name="description" content={description} />
        ),
        keywords.length > 0 && (
          <meta key="kw" name="keywords" content={keywords.join(", ")} />
        ),

        /* --- Open Graph / Twitter ---------------------------------------- */
        seo.ogImage && <meta key="og-img" property="og:image" content={seo.ogImage} />,
        seo.ogType  && <meta key="og-type" property="og:type" content={seo.ogType} />,
        seo.twitterCard && (
          <meta key="tw-card" name="twitter:card" content={seo.twitterCard} />
        ),
        /* --- Canonical ---------------------------------------------------- */
        seo.canonical && <link key="canonical" rel="canonical" href={seo.canonical} />,

        /* --- Robots ------------------------------------------------------- */
        robots && <meta key="robots" name="robots" content={robots} />,

        /* --- Theme Color, Favicon, Author -------------------------------- */
        meta.themeColor && (
          <meta key="theme" name="theme-color" content={meta.themeColor} />
        ),
        meta.favicon && (
          <link key="favicon" rel="icon" href={meta.favicon} />
        ),
        meta.author && (
          <meta key="author" name="author" content={t(meta.author)} />
        ),

        /* --- Structured Data --------------------------------------------- */
        seo.structuredData && (
          <script
            key="ld+json"
            type="application/ld+json"
            // stringify dehors pour éviter la lint « jsx no-dangerously-set-inner-html »
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(seo.structuredData),
            }}
          />
        ),
      ].filter(Boolean)}
    </Helmet>
  );
}