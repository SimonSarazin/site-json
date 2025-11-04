import * as React from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import type { SearchEntity } from "@/modules/search/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { getBaseUrl } from "@/lib/constant/common";
import { ProfileRenderer } from "@/components/profile/ProfileRenderer";
import { useSite } from "@/hooks/useSite";
import type { ProfileConfig } from "@/types/profile-schema";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

function ProfileSkeleton() {
  return (
    <div className="bg-gray-100 -m-4 md:-m-8 animate-pulse">
      <div className="w-full mx-auto bg-white shadow-lg">
        <div className="relative h-96 bg-gray-300 rounded-md"></div>

        <div className="relative px-8 pb-6">
          <div className="flex items-end gap-6 -mt-20">
            <div className="relative">
              <div className="w-40 h-40 rounded-full border-4 border-white bg-gray-300 shadow-xl"></div>
            </div>

            <div className="flex-1 flex justify-between items-end pb-2 flex-wrap gap-4">
              <div className="flex-1">
                <div className="h-8 bg-gray-300 rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <div className="h-10 w-40 bg-gray-300 rounded-lg"></div>
                <div className="h-10 w-48 bg-gray-300 rounded-lg"></div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200"></div>

          <nav className="flex gap-8 mt-4 border-b border-gray-200">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-4 w-20 bg-gray-300 rounded mb-3"></div>
            ))}
          </nav>
        </div>

        <div className="px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-6 bg-gray-300 rounded w-1/4"></div>
              
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>

              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-4/5"></div>
              </div>

              <div className="mt-8">
                <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="w-16 h-16 rounded-lg bg-gray-300"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-gray-300 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 sticky top-4">
                <div className="h-6 bg-gray-300 rounded w-3/4 mb-6"></div>

                <div className="space-y-4 mb-6 pb-6 border-b border-gray-300">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="h-4 bg-gray-300 rounded w-20"></div>
                      <div className="h-4 bg-gray-300 rounded w-8"></div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded bg-gray-300 shrink-0"></div>
                      <div className="h-4 bg-gray-200 rounded flex-1"></div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-300">
                  <div className="h-10 bg-gray-300 rounded w-full"></div>
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
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { organization, entity: cachedEntity, contextType, contextId, helper } = useCocolight();

  React.useEffect(() => {
    if (slug && !slug.startsWith('@')) {
      navigate('/', { replace: true });
    }
  }, [slug, navigate]);

  const cleanSlug = slug?.startsWith('@') ? slug.slice(1) : slug;

  const { data: slugInfo, isLoading: isLoadingSlugInfo } = useQuery({
    queryKey: ["slug-info", cleanSlug],
    queryFn: async () => {
      if (!cleanSlug) {
        throw new Error("Slug manquant");
      }

      try {
        const baseURL = getBaseUrl();
        const url = `${baseURL}/co2/slug/getinfo/key/${cleanSlug}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (err) {
        console.error("Erreur lors de la récupération des infos du slug:", err);
        throw err;
      }
    },
    enabled: !!cleanSlug,
    staleTime: 60 * 1000,
  });

  // Utiliser l'entité depuis le contexte si disponible (déjà chargée dans apiClient)
  // Sinon, charger à la demande pour les pages de profil utilisateur spécifiques
  const { data: entity, isLoading: isLoadingEntity, error } = useQuery<SearchEntity | null>({
    queryKey: ["entity-about", slugInfo?.contextType, slugInfo?.contextId],
    queryFn: async () => {
      // Si l'entité est déjà en cache depuis apiClient, l'utiliser
      if (cachedEntity && contextType === slugInfo?.contextType && contextId === slugInfo?.contextId) {
        return cachedEntity as SearchEntity;
      }

      if (!slugInfo) {
        return null;
      }

      try {
        const baseURL = getBaseUrl();
        const { contextType, contextId } = slugInfo;
        const url = `${baseURL}/co2/element/about/type/${contextType}/id/${contextId}/json/true`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const rawEntity = await response.json();

        try {
          const convertedEntity = helper.fromEntityJSON(rawEntity, organization);
          return convertedEntity as SearchEntity;
        } catch (conversionError) {
          return rawEntity as SearchEntity;
        }
      } catch (err) {
        console.error("Erreur lors de la récupération de l'entité:", err);
        throw err;
      }
    },
    enabled: !!slugInfo?.contextType && !!slugInfo?.contextId,
    staleTime: 60 * 1000,
    // Initialiser avec l'entité en cache si disponible
    initialData: cachedEntity && contextType === slugInfo?.contextType && contextId === slugInfo?.contextId
      ? cachedEntity as SearchEntity
      : undefined,
  });

  const isLoading = isLoadingSlugInfo || isLoadingEntity;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Erreur</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Une erreur est survenue lors du chargement du profil.</p>
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Profil introuvable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Aucun profil trouvé pour le slug: <strong>{slug}</strong></p>
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { config: siteConfig } = useSite();

  const entityType = slugInfo?.contextType || ("collection" in entity ? entity.collection as string : "");

  const profileConfig: ProfileConfig =
    siteConfig?.profiles?.[entityType as keyof typeof siteConfig.profiles] ||
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
      {!profileConfig.hideHeader && <SiteHeader />}

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <ProfileRenderer entity={entity} config={profileConfig} entityType={entityType} />
        </div>
      </main>

      {!profileConfig.hideFooter && <SiteFooter />}
    </div>
  );
}