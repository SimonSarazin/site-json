import { Helmet } from "@dr.pogodin/react-helmet";
import { useLocalization } from "@/hooks/useLocalization";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import type { LocalizedString } from "@/types/locale-schema";

interface AuthSeoProps {
  title?: LocalizedString;
  description?: LocalizedString;
}

/**
 * SEO des pages auth (/login, /register, /recover-password). Calqué sur
 * `AmpliSeo` / `ProfileSeo` (Helmet dédié au module). Les pages auth sont
 * toujours `noindex, nofollow` — elles ne doivent pas être indexées.
 */
export function AuthSeo({ title, description }: AuthSeoProps) {
  const { config } = useSite();
  const { currentLocale } = useLocalization();
  const t = useT();

  const resolvedTitle = title ?? config.meta?.title;
  const pageTitle = resolvedTitle ? t(resolvedTitle) : "";
  const desc = description ? t(description) : "";

  return (
    <Helmet htmlAttributes={{ lang: currentLocale }}>
      {pageTitle ? <title>{pageTitle}</title> : null}
      {desc.length > 0 ? <meta name="description" content={desc} /> : null}
      <meta name="robots" content="noindex, nofollow" />
      <meta property="og:type" content="website" />
      {pageTitle ? <meta property="og:title" content={pageTitle} /> : null}
      <meta property="og:locale" content={currentLocale} />
    </Helmet>
  );
}

export default AuthSeo;
