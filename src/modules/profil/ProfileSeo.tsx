import { Helmet } from "@dr.pogodin/react-helmet";
import { useSite } from "@/hooks/useSite";
import { useLocalization } from "@/hooks/useLocalization";
import type { SearchEntity } from "@/modules/search/schema";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/profil/i18n";

interface ProfileSeoProps {
  entity: SearchEntity | null;
  isLoading: boolean;
  entityType: string;
  activeTab?: string;
}

/**
 * Composant SEO pour ProfilePage - génère dynamiquement les balises meta
 * basées sur les données de l'entité chargée depuis l'API.
 * Les meta tags s'adaptent au tab actif pour améliorer le SEO.
 */
export function ProfileSeo({ entity, isLoading, entityType, activeTab = 'about' }: ProfileSeoProps) {
  const { config } = useSite();
  const { currentLocale, t: tLocale } = useLocalization();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  /**
   * Obtenir le label i18n d'un tab
   */
  const getTabLabel = (tab: string): string => {
    const tabKeys: Record<string, string> = {
      about: "ProfileTemplateDefault.tabs.about",
      news: "ProfileTemplateDefault.tabs.news",
      coworking: "ProfileTemplateDefault.tabs.coworking",
      rooms: "ProfileTemplateDefault.tabs.meetingRooms",
      infos: "ProfileTemplateDefault.tabs.practicalInfo",
      communities: "ProfileTemplateDefault.tabs.communities",
      observatory: "ProfileTemplateDefault.tabs.observatories",
    };
    return tabKeys[tab] ? t(tabKeys[tab]) : "";
  };

  /**
   * Générer une description SEO adaptée au tab actif
   */
  const getTabDescription = (tab: string, entityData: SearchEntity): string => {
    const entityName = entityData.serverData?.name || "";
    const baseDescription = entityData.serverData?.description || entityData.serverData?.shortDescription || "";

    if (tab === "about") {
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
    const defaultTitle = (config.meta?.title && typeof config.meta.title === 'string')
      ? tLocale(config.meta.title)
      : "Profil";
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

  // Construction de l'URL canonique avec le tab actif
  const slug = entity.serverData?.slug || "";
  const canonicalUrl = typeof window !== 'undefined' && slug
    ? activeTab !== 'about'
      ? `${window.location.origin}/profil/${slug}/${activeTab}`
      : `${window.location.origin}/profil/${slug}`
    : "";

  // Titre de la page dynamique selon le tab actif
  const siteTitle = (config.meta?.title && typeof config.meta.title === 'string')
    ? tLocale(config.meta.title)
    : "";

  const pageTitle = activeTab !== 'about'
    ? `${getTabLabel(activeTab)} - ${entityName}${siteTitle ? ` - ${siteTitle}` : ''}`
    : (siteTitle ? `${entityName} - ${siteTitle}` : entityName);

  // Description dynamique selon le tab actif
  const description = getTabDescription(activeTab, entity);

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
  const structuredData = {
    "@context": "https://schema.org",
    "@type": getSchemaType(entityType),
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
    ...(entity.serverData?.url && entity.serverData.url.length > 0 && { sameAs: entity.serverData.url }),
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
      <meta property="og:type" content="website" />
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
