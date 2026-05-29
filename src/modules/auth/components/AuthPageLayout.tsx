import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useSite } from "@/hooks/useSite";
import type { LocalizedString } from "@/types/locale-schema";
import { AuthSeo } from "../AuthSeo";

/**
 * Layout des pages auth (mode page : /login, /register, /recover-password).
 * Header/footer configurables via la section `auth` du config (hideHeader /
 * hideFooter), comme les pages du schéma. Défaut : header + footer affichés.
 * Le SEO (`AuthSeo`) force `noindex` sur ces pages.
 */
export function AuthPageLayout({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title?: LocalizedString;
  description?: LocalizedString;
}) {
  const { config } = useSite();
  const auth = config.auth;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AuthSeo title={title} description={description} />
      {!auth?.hideHeader && <SiteHeader />}
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-md px-4">{children}</div>
      </main>
      {!auth?.hideFooter && <SiteFooter />}
    </div>
  );
}

export default AuthPageLayout;
