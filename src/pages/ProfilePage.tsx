import * as React from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import type { SearchEntity } from "@/modules/search/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getBaseUrl } from "@/lib/constant/common";
import { ProfileRenderer } from "@/components/profile/ProfileRenderer";
import { useSite } from "@/hooks/useSite";
import type { ProfileConfig } from "@/types/profile-schema";

/**
 * Page de profil qui affiche les détails d'une entité
 * en fonction de son slug dans l'URL (/@slug)
 */
export default function ProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { organization, helper } = useCocolight();

  // Vérifier que le slug commence bien par @, sinon rediriger vers 404
  React.useEffect(() => {
    if (slug && !slug.startsWith('@')) {
      navigate('/', { replace: true });
    }
  }, [slug, navigate]);

  // Nettoyer le slug : enlever le @ s'il est présent
  const cleanSlug = slug?.startsWith('@') ? slug.slice(1) : slug;

  // Premier appel : co2/slug/getinfo/key/{slug}
  const { data: slugInfo, isLoading: isLoadingSlugInfo } = useQuery({
    queryKey: ["slug-info", cleanSlug],
    queryFn: async () => {
      if (!cleanSlug) {
        throw new Error("Slug manquant");
      }

      try {
        const baseURL = getBaseUrl();
        const url = `${baseURL}/co2/slug/getinfo/key/${cleanSlug}`;
        console.log("🔍 Premier appel API:", url);

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log("📦 Réponse du premier appel:", data);
        return data;
      } catch (err) {
        console.error("Erreur lors de la récupération des infos du slug:", err);
        throw err;
      }
    },
    enabled: !!cleanSlug,
    staleTime: 60 * 1000,
  });

  // Log pour déboguer
  React.useEffect(() => {
    if (slugInfo) {
      console.log("📋 slugInfo disponible:", slugInfo);
      console.log("  - contextType:", slugInfo?.contextType);
      console.log("  - contextId:", slugInfo?.contextId);
    }
  }, [slugInfo]);

  // Deuxième appel : co2/element/about/type/{contextType}/id/{contextId}/json/true
  // Utilise les données du premier appel (contextId et contextType)
  const { data: entity, isLoading: isLoadingEntity, error } = useQuery<SearchEntity | null>({
    queryKey: ["entity-about", slugInfo?.contextType, slugInfo?.contextId],
    queryFn: async () => {
      if (!organization || !slugInfo) {
        console.log("❌ Deuxième appel bloqué:", { organization: !!organization, slugInfo: !!slugInfo });
        return null;
      }

      try {
        const baseURL = getBaseUrl();
        const { contextType, contextId } = slugInfo;
        const url = `${baseURL}/co2/element/about/type/${contextType}/id/${contextId}/json/true`;

        console.log("🔍 Deuxième appel API:", url);

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const rawEntity = await response.json();
        console.log("📦 Réponse du deuxième appel:", rawEntity);

        // Conversion en entité typée
        try {
          const convertedEntity = helper.fromEntityJSON(rawEntity, organization);
          console.log("✅ Entité convertie:", convertedEntity);
          return convertedEntity as SearchEntity;
        } catch (conversionError) {
          console.error("❌ Erreur lors de la conversion de l'entité:", conversionError);
          // Retourner l'entité brute si la conversion échoue
          console.log("⚠️ Retour de l'entité brute sans conversion");
          return rawEntity as SearchEntity;
        }
      } catch (err) {
        console.error("Erreur lors de la récupération de l'entité:", err);
        throw err;
      }
    },
    enabled: !!organization && !!slugInfo?.contextType && !!slugInfo?.contextId,
    staleTime: 60 * 1000,
  });

  // Log pour déboguer l'état du deuxième appel
  React.useEffect(() => {
    console.log("🔧 État du deuxième appel:", {
      enabled: !!organization && !!slugInfo?.contextType && !!slugInfo?.contextId,
      organization: !!organization,
      hasSlugInfo: !!slugInfo,
      contextType: slugInfo?.contextType,
      contextId: slugInfo?.contextId,
    });
  }, [organization, slugInfo]);

  const isLoading = isLoadingSlugInfo || isLoadingEntity;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement du profil...</p>
        </div>
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

  console.log("🎨 Rendu du profil avec entity:", entity);

  // Récupérer la config du site
  const { config: siteConfig } = useSite();

  // Déterminer le type d'entité
  const entityType = slugInfo?.contextType || ("collection" in entity ? entity.collection as string : "");

  // Récupérer la config du profil pour ce type d'entité
  const profileConfig: ProfileConfig = siteConfig?.profiles?.[entityType as keyof typeof siteConfig.profiles] || {
    layout: "default",
    sections: [
      { type: "profile-header" as const, variant: "hero" as const },
      { type: "profile-info" as const },
      { type: "profile-about" as const },
      { type: "profile-organizer" as const },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <ProfileRenderer entity={entity} config={profileConfig} entityType={entityType} />
    </div>
  );
}
