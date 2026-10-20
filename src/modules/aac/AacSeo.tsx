import { Helmet } from "@dr.pogodin/react-helmet";
import { useLocalization } from "@/hooks/useLocalization";
import { useSite } from "@/hooks/useSite";
import { getSitePublicUrl } from "@/lib/constant/common";

export interface AacSeoProps {
  /** Titre PROPRE à la page (commun, appel). Absent ⇒ le titre du site seul. */
  title?: string | null;
  /** Absente ⇒ la description du site (`meta.description`). */
  description?: string | null;
  /** Image Open Graph, absolue ou relative au site. Absente ⇒ `meta.ogImage`. */
  image?: string | null;
  /** Chemin de la page (`/aac/commun/<id>`), absolutisé sur l'URL publique du site. */
  path?: string | null;
}

/**
 * SEO des deux routes du module (`/aac`, `/aac/commun/:answerId`). Calqué sur
 * `AuthSeo` / `BlogArticleSeo` (Helmet dédié au module) — sans lui, le `<head>`
 * servi par le SSR portait un `<title>` VIDE et aucune balise `og:*`, alors que
 * l'URL d'une fiche est un lien PARTAGEABLE écrit dans les données
 * (`toolsCatalog/utils/communLink.ts`).
 *
 * Enfants Helmet en TABLEAU + conditionnels `? … : null` (jamais `cond && …` :
 * `""` est un descendant rejeté) — même règle que `BlogArticleSeo`.
 */
export function AacSeo({ title, description, image, path }: AacSeoProps) {
  const { config } = useSite();
  const { currentLocale, t } = useLocalization();

  const siteName = config.meta?.title ? t(config.meta.title) : "";
  const pageTitle = (title ?? "").trim();
  // « Titre — Site » : le titre de la page d'abord, le site pour situer. Le
  // titre du site ne doit jamais MASQUER celui de la page (cf. `Seo.tsx`).
  const fullTitle =
    pageTitle && siteName && pageTitle !== siteName ? `${pageTitle} — ${siteName}` : pageTitle || siteName;

  const desc = (description ?? "").trim() || (config.meta?.description ? t(config.meta.description) : "");

  // Les crawlers OG ignorent les URLs relatives : tout est absolutisé sur l'URL
  // PUBLIQUE du site (pas celle du backend — cf. `getSitePublicUrl`).
  const base = getSitePublicUrl().replace(/\/$/, "");
  const absolutize = (u: string) => (/^https?:\/\//i.test(u) ? u : `${base}${u.startsWith("/") ? "" : "/"}${u}`);
  const ogImageRaw = (image ?? "").trim() || config.meta?.ogImage || "";
  const ogImage = ogImageRaw ? absolutize(ogImageRaw) : "";
  const url = path ? `${base}${path.startsWith("/") ? "" : "/"}${path}` : "";

  return (
    <Helmet htmlAttributes={{ lang: currentLocale }}>
      {[
        <title key="title">{fullTitle}</title>,
        desc ? <meta key="desc" name="description" content={desc} /> : null,
        <meta key="og-type" property="og:type" content="website" />,
        fullTitle ? <meta key="og-title" property="og:title" content={fullTitle} /> : null,
        desc ? <meta key="og-desc" property="og:description" content={desc} /> : null,
        ogImage ? <meta key="og-img" property="og:image" content={ogImage} /> : null,
        url ? <meta key="og-url" property="og:url" content={url} /> : null,
        siteName ? <meta key="og-site" property="og:site_name" content={siteName} /> : null,
        <meta key="og-locale" property="og:locale" content={currentLocale} />,
        <meta key="tw-card" name="twitter:card" content={ogImage ? "summary_large_image" : "summary"} />,
        url ? <link key="canonical" rel="canonical" href={url} /> : null,
      ]}
    </Helmet>
  );
}

export default AacSeo;
