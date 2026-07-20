import { Helmet } from "@dr.pogodin/react-helmet";
import { useSite } from "@/hooks/useSite";
import { useLocalization } from "@/hooks/useLocalization";
import { getServerUrl } from "@/lib/constant/common";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import type { ProfileConfig } from "./schema";

interface ProfileSeoProps {
  entity: SearchEntity | null;
  isLoading: boolean;
  entityType: string;
  activeTab?: string;
  profileConfig?: ProfileConfig | null;
}

/**
 * Composant SEO pour ProfilePage - génère dynamiquement les balises meta
 * basées sur les données de l'entité chargée depuis l'API.
 * Les meta tags s'adaptent au tab actif pour améliorer le SEO.
 */
export function ProfileSeo({ entity, isLoading, entityType, activeTab, profileConfig }: ProfileSeoProps) {
  const { config } = useSite();
  const { currentLocale } = useLocalization();
  const t = useT("modules/profil");

  // Obtenir le premier tab de la config ou 'about' par défaut
  const firstTabId = profileConfig?.tabs?.[0]?.id || 'about';
  const currentTab = activeTab || firstTabId;

  /**
   * Obtenir le label i18n d'un tab
   * Vérifie d'abord dans la config des tabs, puis fallback sur les clés i18n
   */
  const getTabLabel = (tab: string): string => {
    // Chercher dans la config des tabs
    const tabConfig = profileConfig?.tabs?.find(tc => tc.id === tab);
    if (tabConfig?.label) {
      return t(tabConfig.label);
    }

    // Fallback sur les clés i18n hardcodées
    const tabKeys: Record<string, string> = {
      about: "ProfileTemplateDefault.tabs.about",
      news: "ProfileTemplateDefault.tabs.news",
      coworking: "ProfileTemplateDefault.tabs.coworking",
      meetingRooms: "ProfileTemplateDefault.tabs.meetingRooms",
      practicalInfo: "ProfileTemplateDefault.tabs.practicalInfo",
      communities: "ProfileTemplateDefault.tabs.communities",
      observatories: "ProfileTemplateDefault.tabs.observatories",
      social: "ProfileTemplateDefault.tabs.social",
      membership: "ProfileTemplateDefault.tabs.membership",
    };
    return tabKeys[tab] ? t(tabKeys[tab]) : "";
  };

  /**
   * Générer une description SEO adaptée au tab actif
   */
  const getTabDescription = (tab: string, entityData: SearchEntity): string => {
    const entityName = entityData.serverData?.name || "";
    const baseDescription = (entityData.serverData?.description || entityData.serverData?.shortDescription || "") as string;

    // Si c'est le premier tab (par défaut), utiliser la description de base
    if (tab === firstTabId) {
      return baseDescription;
    }

    // Vérifier que le tab existe dans la config
    const tabExists = profileConfig?.tabs?.some(t => t.id === tab);
    if (!tabExists) {
      return baseDescription;
    }

    const tabLabel = getTabLabel(tab);
    if (tabLabel) {
      return `${tabLabel} - ${entityName}`;
    }

    return baseDescription;
  };

  // Pendant le chargement ou si pas d'entité, afficher un titre par défaut
  if (isLoading || !entity) {
    const defaultTitle = config.meta?.title ? t(config.meta.title) : "Profil";
    return (
      <Helmet htmlAttributes={{ lang: currentLocale }}>
        <title>{defaultTitle}</title>
      </Helmet>
    );
  }

  // Extraire les données dynamiques de l'entité
  const entityName = entity.serverData?.name || "Profil";
  const imageUrl =
    entity.serverData?.profilMediumImageUrl ||
    entity.serverData?.profilImageUrl ||
    config.meta?.favicon ||
    "";

  // Un POI `type:"article"` a DEUX vues (profil générique + reader blog /blog/:slug). Le reader blog est la
  // présentation CANONIQUE → cette vue profil canonicalise vers /blog/:slug (évite le contenu dupliqué SEO).
  const isArticle = entity.serverData?.type === "article";

  // Construction de l'URL canonique avec le tab actif. `getServerUrl()` (env) fonctionne SSR + client
  // (contrairement à window.location.origin, vide au SSR → canonical/og:url absents du HTML serveur).
  const slug = entity.serverData?.slug || "";
  const origin = getServerUrl().replace(/\/$/, "");
  const canonicalUrl = origin && slug
    ? isArticle
      ? `${origin}/blog/${slug}`
      : currentTab !== firstTabId
        ? `${origin}/profil/${slug}/${currentTab}`
        : `${origin}/profil/${slug}`
    : "";

  // Titre de la page dynamique selon le tab actif
  const siteTitle = config.meta?.title ? t(config.meta.title) : "";

  const pageTitle = currentTab !== firstTabId
    ? `${getTabLabel(currentTab)} - ${entityName}${siteTitle ? ` - ${siteTitle}` : ''}`
    : (siteTitle ? `${entityName} - ${siteTitle}` : entityName);

  // Description dynamique selon le tab actif
  const description = getTabDescription(currentTab, entity);

  // Type schema.org basé sur entityType
  const getSchemaType = (type: string): string => {
    const typeMap: Record<string, string> = {
      organizations: "Organization",
      events: "Event",
      projects: "Project",
      citoyens: "Person",
      poi: "Place",
    };
    return typeMap[type] || "Thing";
  };

  // Données structurées schema.org
  const entityUrl = entity.serverData?.url as string[] | undefined;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": isArticle ? "BlogPosting" : getSchemaType(entityType),
    name: entityName,
    ...(description.length > 0 && { description }),
    ...(imageUrl.length > 0 && { image: imageUrl }),
    ...(canonicalUrl.length > 0 && { url: canonicalUrl }),
    ...(entity.serverData?.address && {
      address: {
        "@type": "PostalAddress",
        streetAddress: entity.serverData.address.streetAddress,
        postalCode: entity.serverData.address.postalCode,
        addressLocality: entity.serverData.address.addressLocality,
      },
    }),
    ...(entityUrl && entityUrl.length > 0 && { sameAs: entityUrl }),
  };

  return (
    <Helmet htmlAttributes={{ lang: currentLocale }}>
      {/* Titre */}
      <title>{pageTitle}</title>

      {/* Meta description */}
      {description.length > 0 && (
        <meta name="description" content={description.substring(0, 160)} />
      )}

      {/* Open Graph */}
      <meta property="og:type" content={isArticle ? "article" : "website"} />
      <meta property="og:title" content={entityName} />
      {description.length > 0 && (
        <meta property="og:description" content={description.substring(0, 160)} />
      )}
      {imageUrl.length > 0 && <meta property="og:image" content={imageUrl} />}
      {canonicalUrl.length > 0 && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:locale" content={currentLocale} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={entityName} />
      {description.length > 0 && (
        <meta name="twitter:description" content={description.substring(0, 160)} />
      )}
      {imageUrl.length > 0 && <meta name="twitter:image" content={imageUrl} />}

      {/* Canonical */}
      {canonicalUrl.length > 0 && <link rel="canonical" href={canonicalUrl} />}

      {/* Robots - permettre l'indexation des profils publics */}
      <meta name="robots" content="index, follow" />

      {/* Structured Data (JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
    </Helmet>
  );
}
