// components/Seo.tsx
import { Helmet } from "@dr.pogodin/react-helmet";
import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/locale-schema";
import { useSite } from "@/hooks/useSite";
import { useCocolight } from "@/hooks/useCocolight";
import { getSitePublicUrl } from "@/lib/constant/common";
import { buildFaviconUrl } from "@/lib/imageUtils";

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
  const { entity } = useCocolight();

  /** 1. Raccourcis vers les deux sources possibles */
  const seo   = page.seo ?? {};
  const meta  = config.meta ?? {};

  let isCity = false;
  let nameElt: string = "";
  const dataCostum = entity?.serverData?.costum as Record<string, unknown> | undefined;
  
  // Créer une copie locale de meta pour éviter de modifier la valeur du hook
  const favicon = dataCostum?.transparentCommune
    ? "https://www.communecter.org" + (dataCostum?.logo as string || dataCostum?.bannerLogoUrl as string) || meta.favicon || ""
    : meta.favicon;

  // Favicon servi via /img en PNG ~64px (≈70 Ko → ≈3 Ko) pour les sources locales raster ;
  // .ico/.svg/externes laissés bruts (cf. buildFaviconUrl).
  const faviconHref = buildFaviconUrl(favicon, 64);

  if(dataCostum?.transparentCommune) {
    isCity = true;
    nameElt = entity?.serverData?.name || "Votre ville";
  }

  /** 2. Fusion des valeurs (page > site > fallback vide).
   * Priorité du titre : seo.title (override page) > page.title (titre propre de
   * la page) > meta.title (défaut du site). Le titre du site ne doit jamais
   * masquer le titre d'une page — sinon toutes les pages partagent le même
   * <title> (mauvais SEO). */
  const pageTitle   = page.title ? t(page.title) : "";
  const title       = isCity         ? nameElt
                    : seo.title      ? t(seo.title)
                    : pageTitle      ? pageTitle
                    : meta.title     ? t(meta.title)
                    : "";

  const description = seo.description  ? t(seo.description)
                    : meta.description ? t(meta.description)
                    : "";

  const keywords    = seo.keywords?.length ? seo.keywords
                    : meta.keywords?.length ? meta.keywords
                    : [];

  /** Open Graph : image page > site ; les chemins relatifs sont absolutisés
   *  (les crawlers OG ignorent les URLs relatives). */
  const ogImageRaw = seo.ogImage ?? meta.ogImage;
  const ogImage = ogImageRaw?.startsWith("/")
    ? getSitePublicUrl().replace(/\/$/, "") + ogImageRaw
    : ogImageRaw;
  const twitterCard = seo.twitterCard ?? (ogImage ? "summary_large_image" : undefined);

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
        title && <meta key="og-title" property="og:title" content={title} />,
        description && (
          <meta key="og-desc" property="og:description" content={description} />
        ),
        ogImage && <meta key="og-img" property="og:image" content={ogImage} />,
        <meta key="og-type" property="og:type" content={seo.ogType ?? "website"} />,
        meta.title && (
          <meta key="og-site" property="og:site_name" content={t(meta.title)} />
        ),
        twitterCard && (
          <meta key="tw-card" name="twitter:card" content={twitterCard} />
        ),
        /* --- Canonical ---------------------------------------------------- */
        seo.canonical && <link key="canonical" rel="canonical" href={seo.canonical} />,

        /* --- Robots ------------------------------------------------------- */
        robots && <meta key="robots" name="robots" content={robots} />,

        /* --- Theme Color, Favicon, Author -------------------------------- */
        meta.themeColor && (
          <meta key="theme" name="theme-color" content={meta.themeColor} />
        ),
        favicon && (
          <link key="favicon" rel="icon" href={faviconHref} />
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