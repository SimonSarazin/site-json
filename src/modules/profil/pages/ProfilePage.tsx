import { useParams, useNavigate, useLoaderData, useLocation } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProfileRenderer } from "@/modules/profil/ProfileRenderer";
import { useSite } from "@/hooks/useSite";
import type { ProfileConfig, ProfileType } from "@/modules/profil/schema";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

import { ProfileSeo } from "@/modules/profil/ProfileSeo";
import { ProfileEntityProvider } from "../contexts/ProfileEntityProvider";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/profil/i18n";
import { useQueryEntityBySlug } from "../hooks/useQueryEntityBySlug";

/**
 * Type guard pour vérifier si entityType est une clé valide de ProfilesConfig
 */
function isValidProfileKey(key: string): key is ProfileType | "default" {
  return ["events", "organizations", "projects", "citoyens", "poi", "default"].includes(key);
}

function ProfileSkeleton() {
  return (
    <div className="bg-muted -m-4 md:-m-8 animate-pulse">
      <div className="w-full mx-auto bg-card shadow-lg">
        <div className="relative h-96 bg-muted rounded-md"></div>

        <div className="relative px-8 pb-6">
          <div className="flex items-end gap-6 -mt-20">
            <div className="relative">
              <div className="w-40 h-40 rounded-full border-4 border-border bg-muted shadow-xl"></div>
            </div>

            <div className="flex-1 flex justify-between items-end pb-2 flex-wrap gap-4">
              <div className="flex-1">
                <div className="h-8 bg-muted rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-muted/50 rounded w-1/3"></div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <div className="h-10 w-40 bg-muted rounded-lg"></div>
                <div className="h-10 w-48 bg-muted rounded-lg"></div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-border"></div>

          <nav className="flex gap-8 mt-4 border-b border-border">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-4 w-20 bg-muted rounded mb-3"></div>
            ))}
          </nav>
        </div>

        <div className="px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-6 bg-muted rounded w-1/4"></div>

              <div className="space-y-3">
                <div className="h-4 bg-muted/50 rounded w-full"></div>
                <div className="h-4 bg-muted/50 rounded w-full"></div>
                <div className="h-4 bg-muted/50 rounded w-5/6"></div>
              </div>

              <div className="space-y-3">
                <div className="h-4 bg-muted/50 rounded w-full"></div>
                <div className="h-4 bg-muted/50 rounded w-full"></div>
                <div className="h-4 bg-muted/50 rounded w-4/5"></div>
              </div>

              <div className="mt-8">
                <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
                <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg border border-border">
                  <div className="w-16 h-16 rounded-lg bg-muted"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-muted rounded w-1/2"></div>
                    <div className="h-3 bg-muted/50 rounded w-1/3"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-muted/50 rounded-lg border border-border p-6 sticky top-4">
                <div className="h-6 bg-muted rounded w-3/4 mb-6"></div>

                <div className="space-y-4 mb-6 pb-6 border-b border-border">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="h-4 bg-muted rounded w-20"></div>
                      <div className="h-4 bg-muted rounded w-8"></div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded bg-muted shrink-0"></div>
                      <div className="h-4 bg-muted/50 rounded flex-1"></div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-border">
                  <div className="h-10 bg-muted rounded w-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const loaderData = useLoaderData() as { entity?: unknown; activeTab?: string } | null;

  // Détecter le tab actif depuis le loader (SSR) ou depuis l'URL (fallback client)
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const activeTab = loaderData?.activeTab || (pathSegments.length > 2 ? pathSegments[2] : 'about');

  // Avec le pattern profil/:slug, le paramètre slug est directement le slug sans préfixe
  const { data: entity, isLoading, isError } = useQueryEntityBySlug({ slug });
  const { config: siteConfig } = useSite();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <ProfileSeo entity={null} isLoading={true} entityType="default" activeTab={activeTab} />
        <SiteHeader />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-8">
            <ProfileSkeleton />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (isError) {
    return (
      <>
        <ProfileSeo entity={null} isLoading={false} entityType="default" activeTab={activeTab} />
        <div className="container mx-auto px-4 py-8">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">{t("ProfilePage.error.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{t("ProfilePage.error.message")}</p>
              <Button onClick={() => navigate(-1)} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.back")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (!entity) {
    return (
      <>
        <ProfileSeo entity={null} isLoading={false} entityType="default" activeTab={activeTab} />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>{t("ProfilePage.notFound.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{t("ProfilePage.notFound.message")} <strong>{slug}</strong></p>
              <Button onClick={() => navigate(-1)} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.back")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Déterminer le type d'entité (entity est toujours une instance grâce à useQueryEntityBySlug)
  const rawEntityType = entity?.getEntityType?.() || "";
  const entityType = isValidProfileKey(rawEntityType) ? rawEntityType : "default";

  // Récupérer la config de profil pour ce type d'entité
  const profileConfig: ProfileConfig =
    (entityType !== "default" && siteConfig?.profiles?.[entityType]) ||
    siteConfig?.profiles?.default ||
    {
      layout: "default",
      sections: [
        { type: "profile-header" as const, variant: "hero" as const },
        { type: "profile-info" as const },
        { type: "profile-about" as const },
        { type: "profile-organizer" as const },
      ],
      hideHeader: false,
      hideFooter: false,
    };

  return (
    <div className="min-h-screen flex flex-col">
      <ProfileSeo entity={entity} isLoading={false} entityType={entityType} activeTab={activeTab} />
      {!profileConfig.hideHeader && <SiteHeader />}

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <ProfileEntityProvider entity={entity} config={profileConfig} entityType={entityType}>
            <ProfileRenderer />
          </ProfileEntityProvider>
        </div>
      </main>

      {!profileConfig.hideFooter && <SiteFooter />}
    </div>
  );
}