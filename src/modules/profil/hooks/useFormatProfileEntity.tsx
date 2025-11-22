import { useMemo } from "react";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import type { SearchEntity } from "@/modules/search/schema";
import type { GeoCoordinates, OpeningHoursEntry, PostalAddress } from "@communecter/cocolight-api-client";


interface Badge {
  name?: string;
  show?: string | boolean;
  [key: string]: unknown;
}

interface Organizer {
  name?: string;
  slug?: string;
  profilThumbImageUrl?: string;
  [key: string]: unknown;
}


/**
 * Hook pour extraire et formater les données d'une entité de profil
 * @param entity - L'entité SearchEntity provenant de l'API
 * @returns Objet contenant toutes les données formatées du profil
 */
export function useFormatProfileEntity(entity: SearchEntity) {
  // Images - Utilisation de useReactiveProperty pour réactivité automatique
  const logoUrl = useReactiveProperty<string>(entity.serverData, 'profilImageUrl') ?? null;
  const logoThumbUrl = useReactiveProperty<string>(entity.serverData, 'profilThumbImageUrl') ?? null;

  // imageUrl avec fallback
  const profilMediumImageUrl = useReactiveProperty<string>(entity.serverData, 'profilMediumImageUrl');
  const profilImageUrl = useReactiveProperty<string>(entity.serverData, 'profilImageUrl');
  const imageUrl = profilMediumImageUrl ?? profilImageUrl ?? null;

  // Address - réactif
  const addressRaw = useReactiveProperty(entity.serverData, 'address');
  const address = useMemo((): PostalAddress | null => {
    if (addressRaw && typeof addressRaw === "object") {
      return {
        streetAddress: (addressRaw as any)?.streetAddress,
        postalCode: (addressRaw as any)?.postalCode,
        addressLocality: (addressRaw as any)?.addressLocality
      };
    }
    return null;
  }, [addressRaw]);

  // Organizer - réactif
  const organizerRaw = useReactiveProperty(entity.serverData, 'organizer');
  const organizer = useMemo((): Organizer | null => {
    if (organizerRaw && typeof organizerRaw === "object") {
      const organizerId = Object.keys(organizerRaw)[0];
      return (organizerRaw as Record<string, Organizer>)[organizerId];
    }
    return null;
  }, [organizerRaw]);

  // Tous les organizers - réactif
  const organizers = useMemo((): Record<string, Organizer> => {
    if (organizerRaw && typeof organizerRaw === "object") {
      return organizerRaw as Record<string, Organizer>;
    }
    return {};
  }, [organizerRaw]);

  // Informations de base - Utilisation de useReactiveProperty
  const name = useReactiveProperty<string>(entity.serverData, 'name') ?? "Sans nom";
  const shortDescription = useReactiveProperty<string>(entity.serverData, 'shortDescription') ?? null;
  const description = useReactiveProperty<string>(entity.serverData, 'description') ?? null;
  const type = useReactiveProperty<string>(entity.serverData, 'type') ?? null;

  // Banner avec fallback - appeler les hooks au top level
  const primaryBanner = useReactiveProperty<string>(entity.serverData, 'profilBannerUrl');
  const fallbackBanner = useReactiveProperty<string>(entity.serverData, 'profilRealBannerUrl');
  const bannerUrl = primaryBanner ?? fallbackBanner ?? null;

  // Tags - réactif
  const tagsRaw = useReactiveProperty(entity.serverData, 'tags');
  const tags = useMemo((): string[] => {
    if (tagsRaw && Array.isArray(tagsRaw)) {
      return tagsRaw.filter((tag: unknown): tag is string => typeof tag === "string");
    }
    return [];
  }, [tagsRaw]);

  // Badges - réactif
  const badgesRaw = useReactiveProperty(entity.serverData, 'badges');
  const badges = useMemo((): Badge[] => {
    if (badgesRaw && typeof badgesRaw === "object") {
      return Object.values(badgesRaw).filter((badge: unknown): badge is Badge =>
        badge !== null &&
        typeof badge === "object" &&
        "show" in badge &&
        badge.show !== "false"
      );
    }
    return [];
  }, [badgesRaw]);

  // Members & Projects counts - réactif
  const linksRaw = useReactiveProperty(entity.serverData, 'links');
  const membersCount = useMemo((): number | null => {
    if (linksRaw && typeof linksRaw === "object") {
      const links = linksRaw as Record<string, unknown>;
      if (links.members && typeof links.members === "object") {
        return Object.keys(links.members as Record<string, unknown>).length;
      }
    }
    return null;
  }, [linksRaw]);

  const projectsCount = useMemo((): number | null => {
    if (linksRaw && typeof linksRaw === "object") {
      const links = linksRaw as Record<string, unknown>;
      if (links.projects && typeof links.projects === "object") {
        return Object.keys(links.projects as Record<string, unknown>).length;
      }
    }
    return null;
  }, [linksRaw]);

  // Opening hours - réactif
  const openingHoursRaw = useReactiveProperty(entity.serverData, 'openingHours');
  const openingHours = useMemo((): OpeningHoursEntry[] | null => {
    if (openingHoursRaw && Array.isArray(openingHoursRaw)) {
      return openingHoursRaw as OpeningHoursEntry[];
    }
    return null;
  }, [openingHoursRaw]);

  // Dates - Utilisation de useReactiveProperty
  const startDate = useReactiveProperty(entity.serverData, 'startDate') ?? null;
  const endDate = useReactiveProperty(entity.serverData, 'endDate') ?? null;
  const openingDate = useReactiveProperty(entity.serverData, 'openingDate') ?? null;

  // Contact - Utilisation de useReactiveProperty
  const email = useReactiveProperty<string>(entity.serverData, 'email') ?? null;
  const mobile = useReactiveProperty<string>(entity.serverData, 'mobile') ?? null;
  const url = useReactiveProperty<string>(entity.serverData, 'url') ?? null;
  const username = useReactiveProperty<string>(entity.serverData, 'username') ?? null;
  const externalLinkRegistration = useReactiveProperty<string>(entity.serverData, 'externalLinkRegistration') ?? null;

  // Géolocalisation - réactif
  const geoRaw = useReactiveProperty(entity.serverData, 'geo');
  const geo = useMemo((): GeoCoordinates | null => {
    if (geoRaw && typeof geoRaw === "object") {
      return geoRaw as GeoCoordinates;
    }
    return null;
  }, [geoRaw]);

  return {
    // Images
    logoUrl,
    logoThumbUrl,
    imageUrl,
    bannerUrl,

    // Informations de base
    name,
    shortDescription,
    description,
    type,

    // Adresse et localisation
    address,
    geo,

    // Organisateurs
    organizer,
    organizers,

    // Dates
    startDate,
    endDate,
    openingDate,
    openingHours,

    // Contact
    email,
    mobile,
    url,
    username,
    externalLinkRegistration,

    // Métadonnées
    tags,
    badges,
    membersCount,
    projectsCount,
  };
}
