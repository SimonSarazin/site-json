import { Helmet } from "@dr.pogodin/react-helmet";
import { useSite } from "@/hooks/useSite";
import { useLocalization } from "@/hooks/useLocalization";
import type { SearchEntity } from "@/modules/search/schema";

interface ProfileSeoProps {
  entity: SearchEntity | null;
  isLoading: boolean;
  entityType: string;
}

/**
 * Composant SEO pour ProfilePage - génère dynamiquement les balises meta
 * basées sur les données de l'entité chargée depuis l'API.
 */
export function ProfileSeo({ entity, isLoading, entityType }: ProfileSeoProps) {
  const { config } = useSite();
  const { currentLocale, t } = useLocalization();

  // Pendant le chargement ou si pas d'entité, afficher un titre par défaut
  if (isLoading || !entity) {
    const defaultTitle = (config.meta?.title && typeof config.meta.title === 'string')
      ? t(config.meta.title)
      : "Profil";
    return (
      <Helmet htmlAttributes={{ lang: currentLocale }}>
        <title>{defaultTitle}</title>
      </Helmet>
    );
  }

  // Extraire les données dynamiques de l'entité
  const entityName = entity.serverData?.name || "Profil";
  const shortDescription = entity.serverData?.shortDescription || "";
  const description = entity.serverData?.description || shortDescription || "";
  const imageUrl =
    entity.serverData?.profilMediumImageUrl ||
    entity.serverData?.profilImageUrl ||
    config.meta?.favicon ||
    "";

  // Construction de l'URL canonique
  const slug = entity.serverData?.slug || "";
  const canonicalUrl = typeof window !== 'undefined' && slug
    ? `${window.location.origin}/profil/${slug}`
    : "";

  // Titre de la page
  const siteTitle = (config.meta?.title && typeof config.meta.title === 'string')
    ? t(config.meta.title)
    : "";
  const pageTitle = siteTitle ? `${entityName} - ${siteTitle}` : entityName;

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
